// netlify/functions/gmail-sync.js
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// ---------- tiny utils ----------
const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const chunk = (arr, n) =>
  arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i + n)]), []);

// Base64url → utf8 (for Gmail parts)
const b64uToUtf8 = (s = '') => {
  try {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
};

// Recursively pull a concise text body (prefers text/plain, falls back to stripped html)
function extractBody(payload, cap = 10000) {
  if (!payload) return '';
  // direct body
  if (payload.body?.data) return b64uToUtf8(payload.body.data).slice(0, cap);

  const parts = payload.parts || [];
  // try plain parts first
  for (const p of parts) {
    if (p.mimeType && p.mimeType.toLowerCase().includes('text/plain') && p.body?.data) {
      return b64uToUtf8(p.body.data).slice(0, cap);
    }
  }
  // then any parts (strip html)
  for (const p of parts) {
    const t = extractBody(p, cap);
    if (t) return t;
  }
  return '';
}

// ---------- simple classifier (subject/body/from) ----------
const WORD = (xs) => new RegExp(`\\b(${xs.join('|')})\\b`, 'i');

const ORDER_RX = WORD([
  'order confirmation',
  'thanks for your order',
  'we received your order',
  'order placed',
  'receipt',
  'invoice',
  'pedido',        // ES
  'commande',      // FR
  'pedido confirmado',
  'order #',
  'order no',
]);

const SHIP_RX = WORD([
  'shipped',
  'has shipped',
  'on its way',
  'in transit',
  'track your package',
  'tracking number',
  'track shipment',
  'dispatched',
  'fulfilled',
  'out for delivery',
]);

const DELIVERED_RX = WORD([
  'delivered',
  'has been delivered',
  'package delivered',
  'delivered today',
]);

// Light retailer hint (optional)
const RETAILER_DOMAINS = [
  'amazon', 'ebay', 'walmart', 'target', 'bestbuy', 'apple',
  'nike', 'adidas', 'shopify', 'etsy', 'costco', 'homedepot',
  'lowes', 'microcenter', 'newegg', 'bhphotovideo', 'gamestop'
];

function classify({ subject = '', body = '', from = '' }) {
  const s = subject.toLowerCase();
  const b = body.toLowerCase();
  const f = from.toLowerCase();

  const looksRetailer = RETAILER_DOMAINS.some(d => f.includes(d));

  // Strong signals first (subject)
  if (ORDER_RX.test(s) || (looksRetailer && ORDER_RX.test(b))) return 'order';
  if (SHIP_RX.test(s)  || (looksRetailer && SHIP_RX.test(b)))  return 'shipment';
  if (DELIVERED_RX.test(s) || (looksRetailer && DELIVERED_RX.test(b))) return 'delivery';

  // Fallback using body only
  if (ORDER_RX.test(b)) return 'order';
  if (SHIP_RX.test(b))  return 'shipment';
  if (DELIVERED_RX.test(b)) return 'delivery';

  return null;
}

// ---------- function ----------
export const handler = async (event) => {
  const debug = /\bdebug=1\b/.test(event.rawQuery || '');
  const log = (...a) => { if (debug) console.log(...a); };

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GMAIL_SYNC_LIMIT,
    GMAIL_SYNC_PAGES,
    GMAIL_SYNC_BATCH_SIZE,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return json(500, { error: 'Missing Google OAuth env vars' });
  }

  // runtime knobs
  const qs = new URLSearchParams(event.rawQuery || '');
  const LIMIT = Math.max(1, Math.min(300, Number(qs.get('limit')) || Number(GMAIL_SYNC_LIMIT) || 100));
  const PAGES = Math.max(1, Math.min(5, Number(qs.get('pages')) || Number(GMAIL_SYNC_PAGES) || 2));
  const INSERT_BATCH = Math.max(1, Math.min(25, Number(GMAIL_SYNC_BATCH_SIZE) || 10));

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'gmail-sync/orders-only' } },
  });

  try {
    log('stage: start', { LIMIT, PAGES, INSERT_BATCH });

    // 1) get account
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

    // 2) OAuth
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

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // 3) Gmail query focused on commerce
    // Keep it short so Gmail accepts it. (You can tweak keywords as needed.)
    const QUERY =
      'newer_than:90d -in:spam -in:trash ("order confirmation" OR shipped OR tracking OR delivered OR receipt OR invoice)';

    // page through results (LIMIT, PAGES)
    const fetched = [];
    let pageToken;
    for (let i = 0; i < PAGES && fetched.length < LIMIT; i++) {
      const left = LIMIT - fetched.length;
      const res = await gmail.users.messages.list({
        userId: 'me',
        maxResults: Math.min(100, left),
        q: QUERY,
        pageToken,
      });
      const msgs = res.data.messages || [];
      fetched.push(...msgs);
      pageToken = res.data.nextPageToken;
      if (!pageToken) break;
    }
    log('gmail list count:', fetched.length);
    if (fetched.length === 0) return json(200, { imported: 0, skipped_existing: 0, fetch_errors: 0 });

    // 4) fetch + classify
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
            const subj = headers['subject'] || '';
            const from = headers['from'] || '';
            const body = extractBody(payload, 16000);
            const hint = classify({ subject: subj, body, from });

            if (!hint) {
              return { ok: false, id: m.id, reason: 'not-commerce' };
            }

            const dateStr = headers['date'] || null;
            const dateIso = dateStr ? new Date(dateStr).toISOString() : null;
            const internalMs = Number(msg.data.internalDate || (dateIso ? Date.parse(dateIso) : Date.now()));

            // keep raw small-ish, and attach event_hint
            const rawSlim = {
              id: msg.data.id,
              threadId: msg.data.threadId,
              labelIds: msg.data.labelIds || [],
              historyId: msg.data.historyId,
              internalDate: msg.data.internalDate,
              snippet: msg.data.snippet,
              payload: {
                mimeType: payload.mimeType,
                headers: payload.headers,
              },
              event_hint: hint, // <— store classification hint here
            };

            return {
              ok: true,
              data: {
                user_id: acct.user_id,
                provider: 'gmail',
                email_address: acct.email_address || null,
                message_id: m.id,
                thread_id: msg.data.threadId || null,
                subject: subj,
                snippet: msg.data.snippet || null,
                from_addr: from || null,
                to_addr: headers['to'] || null,
                date_header: dateIso,
                internal_timestamp_ms: Number.isFinite(internalMs) ? internalMs : null,
                raw_json: rawSlim,
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
    const fetchErrors = details.filter((d) => !d.ok && d.error).length;
    const nonCommerceSkipped = details.filter((d) => !d.ok && d.reason === 'not-commerce').length;

    if (okRows.length === 0) {
      return json(200, {
        imported: 0,
        skipped_existing: 0,
        fetch_errors: fetchErrors,
        non_commerce_skipped: nonCommerceSkipped,
      });
    }

    // 5) skip existing by message_id
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

    // 6) insert in tiny batches
    let inserted = 0;
    for (const insBatch of chunk(toInsert, Number(process.env.GMAIL_SYNC_BATCH_SIZE) || 10)) {
      const { error: insErr } = await admin.from('email_raw').insert(insBatch, { returning: 'minimal' });
      if (insErr) throw insErr;
      inserted += insBatch.length;
    }

    return json(200, {
      imported: inserted,
      skipped_existing: existing.size,
      fetch_errors: fetchErrors,
      non_commerce_skipped: nonCommerceSkipped,
      limit_used: LIMIT,
      pages_used: Math.min(PAGES, Math.ceil(fetched.length / 100)),
    });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e.message || e) });
  }
};
