// netlify/functions/gmail-sync.js
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

// tiny helper to chunk arrays
const chunk = (arr, n) =>
  arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i + n)]), []);

export const handler = async (event) => {
  const debug = /\bdebug=1\b/.test(event.rawQuery || '');
  const log = (...a) => { if (debug) console.log(...a); };

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GMAIL_SYNC_LIMIT,            // optional (default 100)
    GMAIL_SYNC_PAGES,            // optional (default 2)
    GMAIL_SYNC_BATCH_SIZE,       // optional (default 10 inserts per statement)
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return json(500, { error: 'Missing Google OAuth env vars' });
  }

  // allow URL ?limit= & ?pages= to override, else env, else defaults
  const qs = new URLSearchParams(event.rawQuery || '');
  const LIMIT = Math.max(
    1,
    Math.min(
      300,
      Number(qs.get('limit')) || Number(GMAIL_SYNC_LIMIT) || 100
    )
  );
  const PAGES = Math.max(1, Math.min(5, Number(qs.get('pages')) || Number(GMAIL_SYNC_PAGES) || 2));
  const INSERT_BATCH = Math.max(1, Math.min(25, Number(GMAIL_SYNC_BATCH_SIZE) || 10));

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'gmail-sync/timeout-safe' } },
  });

  try {
    log('stage: start', { LIMIT, PAGES, INSERT_BATCH });

    // 1) Get the most recent connected Gmail account
    const { data: acctRows, error: acctErr } = await admin
      .from('email_accounts')
      .select('id, provider, email_address, user_id, access_token, refresh_token, expires_at')
      .eq('provider', 'gmail')
      .not('refresh_token', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (acctErr) throw acctErr;
    const acct = acctRows?.[0];
    if (!acct) return json(400, { error: 'No Gmail account connected' });
    if (!acct.user_id) return json(400, { error: "email_accounts.user_id is null; set it to the auth user's id" });

    // 2) OAuth client
    const oAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
    oAuth2Client.setCredentials({
      refresh_token: acct.refresh_token,
      access_token: acct.access_token || undefined,
      expiry_date: acct.expires_at ? Number(acct.expires_at) * 1000 : undefined,
    });

    const token = await oAuth2Client.getAccessToken();
    if (!token?.token) return json(500, { error: 'Could not obtain access token' });
    log('access token ok');

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // 3) List recent messages (paged; capped by LIMIT)
    const fetched = [];
    let pageToken = undefined;
    let loops = 0;
    while (loops < PAGES && fetched.length < LIMIT) {
      const left = LIMIT - fetched.length;
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: Math.min(100, left),
        // basic filter to reduce noise; adjust as you like
        q: 'newer_than:30d (order OR receipt OR "order confirmation" OR shipped OR tracking)',
        pageToken,
      });
      const msgs = listRes.data.messages || [];
      fetched.push(...msgs);
      pageToken = listRes.data.nextPageToken;
      loops++;
      if (!pageToken) break;
    }
    log('gmail list count:', fetched.length);
    if (fetched.length === 0) return json(200, { imported: 0 });

    // 4) Fetch details in small batches
    const details = [];
    for (const batch of chunk(fetched, 20)) {
      const got = await Promise.all(
        batch.map(async (m) => {
          try {
            const msg = await gmail.users.messages.get({
              userId: 'me',
              id: m.id,
              format: 'full',
            });

            const payload = msg.data.payload || {};
            const headers = (payload.headers || []).reduce((map, h) => {
              map[h.name.toLowerCase()] = h.value;
              return map;
            }, {});

            const dateStr = headers['date'] || null;
            const dateIso = dateStr ? new Date(dateStr).toISOString() : null;
            const internalMs = Number(
              msg.data.internalDate || (dateIso ? Date.parse(dateIso) : Date.now())
            );

            // Keep raw_json small-ish to avoid huge insert statements
            const rawSlim = {
              id: msg.data.id,
              threadId: msg.data.threadId,
              labelIds: msg.data.labelIds || [],
              historyId: msg.data.historyId,
              internalDate: msg.data.internalDate,
              sizeEstimate: msg.data.sizeEstimate,
              snippet: msg.data.snippet,
              payload: {
                mimeType: payload.mimeType,
                headers: payload.headers, // still useful for parsing
                parts: payload.parts ? payload.parts.slice(0, 3) : null, // cap parts to reduce bloat
              },
            };

            return {
              ok: true,
              data: {
                user_id: acct.user_id,
                provider: 'gmail',
                email_address: acct.email_address || null,
                message_id: m.id,
                thread_id: msg.data.threadId || null,
                subject: headers['subject'] || '',
                snippet: msg.data.snippet || null,
                from_addr: headers['from'] || null,
                to_addr: headers['to'] || null,
                date_header: dateIso, // timestamptz
                internal_timestamp_ms: Number.isFinite(internalMs) ? internalMs : null,
                raw_json: rawSlim,    // keep; but trimmed
              },
            };
          } catch (e) {
            return { ok: false, id: m.id, error: String(e.message || e) };
          }
        })
      );
      details.push(...got);
    }

    const okRows = details.filter((d) => d.ok).map((d) => d.data);
    const errs = details.filter((d) => !d.ok);
    if (debug && errs.length) log('fetch errors:', errs.slice(0, 3));

    if (okRows.length === 0) {
      return json(200, { imported: 0, errors: errs.length });
    }

    // 5) Get existing message_ids to avoid heavy upserts
    const ids = okRows.map((r) => r.message_id);
    const existing = new Set();

    for (const idBatch of chunk(ids, 100)) {
      const { data: existRows, error: existErr } = await admin
        .from('email_raw')
        .select('message_id')
        .in('message_id', idBatch);

      if (existErr) throw existErr;
      for (const r of existRows || []) existing.add(r.message_id);
    }

    const toInsert = okRows.filter((r) => !existing.has(r.message_id));
    log('new rows to insert:', toInsert.length);

    // 6) Insert in very small batches with minimal returning to avoid timeouts
    let inserted = 0;
    for (const insBatch of chunk(toInsert, INSERT_BATCH)) {
      const { error: insErr } = await admin
        .from('email_raw')
        .insert(insBatch, { returning: 'minimal' });
      if (insErr) throw insErr;
      inserted += insBatch.length;
    }

    return json(200, {
      imported: inserted,
      skipped_existing: existing.size,
      fetch_errors: errs.length,
      limit_used: LIMIT,
      pages_used: loops,
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e.message || e) });
  }
};
