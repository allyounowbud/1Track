// netlify/functions/gmail-sync.js
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { randomUUID } from 'crypto';

export const handler = async (event) => {
  const debug = /\bdebug=1\b/.test(event.rawQuery || '');

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const log = (...args) => debug && console.log(...args);
  const respond = (status, body) => ({
    statusCode: status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  try {
    log('stage: start');

    // Find the most recently connected Gmail account for this site (single-user)
    // If you support multi-user, key this by the current supabase auth user.
    const { data: acctRows, error: acctErr } = await admin
      .from('email_accounts')
      .select('id, provider, email_address, user_id, access_token, refresh_token, expires_at')
      .eq('provider', 'gmail')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (acctErr) throw acctErr;
    const acct = acctRows?.[0];
    if (!acct) return respond(400, { error: 'No Gmail account connected' });
    log('account', JSON.stringify({ provider: acct.provider, email: acct.email_address, user_id: acct.user_id }));

    // Prepare OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Refresh access token if needed
    if (!acct.refresh_token) {
      return respond(400, { error: 'Missing refresh_token; reconnect Gmail' });
    }
    oAuth2Client.setCredentials({
      refresh_token: acct.refresh_token,
      access_token: acct.access_token || undefined,
      expiry_date: acct.expires_at ? Number(acct.expires_at) * 1000 : undefined,
    });

    // Get a fresh access token (googleapis handles caching/refresh)
    const token = await oAuth2Client.getAccessToken();
    if (!token || !token.token) {
      return respond(500, { error: 'Could not obtain access token' });
    }
    log('access token acquired');

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // Fetch recent messages that look like orders/shipping
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: 'newer_than:30d (order OR receipt OR "order confirmation" OR shipped OR tracking)',
    });
    const messages = listRes.data.messages || [];
    log('gmail list', JSON.stringify({ count: messages.length }));

    if (messages.length === 0) {
      return respond(200, { imported: 0 });
    }

    // Fetch each message (metadata + raw)
    const details = await Promise.all(
      messages.map(async (m) => {
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

          // RFC 2822 Date header → JS date
          const dateStr = headers['date'];
          const dateMs = dateStr ? Date.parse(dateStr) : Date.now();

          // Subject
          const subject = headers['subject'] || '';

          return {
            ok: true,
            gmail_id: m.id,
            thread_id: msg.data.threadId || null,
            internal_ts: Number(msg.data.internalDate || dateMs),
            date_header: dateStr || null,
            from: headers['from'] || null,
            to: headers['to'] || null,
            subject,
            snippet: msg.data.snippet || null,
            payload,
          };
        } catch (e) {
          return { ok: false, gmail_id: m.id, error: String(e.message || e) };
        }
      })
    );

    // Build raw rows (include a UUID id so DB default not required)
    const rawRows = details
      .filter((d) => d.ok)
      .map((d) => ({
        id: randomUUID(), // <— important: always set id
        user_id: acct.user_id, // who this data belongs to
        provider: 'gmail',
        email_address: acct.email_address,
        message_id: d.gmail_id,        // Gmail’s message id (unique per account)
        thread_id: d.thread_id,        // optional
        subject: d.subject,
        snippet: d.snippet,
        from_addr: d.from,
        to_addr: d.to,
        date_header: d.date_header,
        internal_timestamp_ms: d.internal_ts,
        raw_json: d.payload,           // store payload for future parsing improvements
        created_at: new Date().toISOString(),
      }));

    // Upsert by message_id to avoid duplicates
    const { error: rawErr } = await admin
      .from('email_raw')
      .upsert(rawRows, { onConflict: 'message_id' });

    if (rawErr) throw rawErr;

    // Optionally call a DB function to parse into normalized tables
    // (If you have a SQL function named parse_email_raw, call it here)
    // const { error: parseErr } = await admin.rpc('parse_email_raw');
    // if (parseErr) throw parseErr;

    return respond(200, { imported: rawRows.length });
  } catch (err) {
    console.error(err);
    return respond(500, { error: String(err.message || err) });
  }
};
