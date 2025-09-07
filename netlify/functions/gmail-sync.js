// netlify/functions/gmail-sync.js
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const debug = /\bdebug=1\b/.test(event.rawQuery || '');
  const log = (...a) => { if (debug) console.log(...a); };

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  } = process.env;

  // Basic env checks
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return json(500, { error: 'Missing Google OAuth env vars' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    log('stage: start');

    // 1) Grab latest Gmail account row (must have user_id + refresh_token)
    const { data: acctRows, error: acctErr } = await admin
      .from('email_accounts')
      .select('id, provider, email_address, user_id, access_token, refresh_token, expires_at')
      .eq('provider', 'gmail')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (acctErr) throw acctErr;
    const acct = acctRows?.[0];
    if (!acct) return json(400, { error: 'No Gmail account connected' });
    if (!acct.user_id) return json(400, { error: 'email_accounts.user_id is null; set it to the auth user id' });
    if (!acct.refresh_token) return json(400, { error: 'Missing refresh_token; reconnect Gmail' });

    log('account', JSON.stringify({
      provider: acct.provider,
      email: acct.email_address,
      user_id: acct.user_id,
    }));

    // 2) Build OAuth client, ensure access token
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

    // 3) List recent messages (a couple pages)
    const fetched = [];
    let pageToken = undefined;
    let loops = 0;
    do {
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: 'newer_than:30d (order OR receipt OR "order confirmation" OR shipped OR tracking)',
        pageToken,
      });
      const msgs = listRes.data.messages || [];
      fetched.push(...msgs);
      pageToken = listRes.data.nextPageToken;
      loops++;
    } while (pageToken && loops < 3);

    log('gmail list count:', fetched.length);
    if (fetched.length === 0) return json(200, { imported: 0 });

    // 4) Fetch details in small batches
    const chunk = (arr, n) => arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i + n)]), []);
    const details = [];

    for (const batch of chunk(fetched, 25)) {
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

            return {
              ok: true,
              data: {
                id: randomUUID(),
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
                raw_json: msg.data,   // full Gmail message JSON
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
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
    if (debug && errs.length) log('fetch errors', errs);

    // 5) Upsert into email_raw (requires unique index on message_id)
    if (okRows.length) {
      const { error: upErr } = await admin
        .from('email_raw')
        .upsert(okRows, { onConflict: 'message_id' });
      if (upErr) throw upErr;
    }

    return json(200, { imported: okRows.length, errors: errs.length, ...(debug ? { errs } : {}) });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e.message || e) });
  }
};
