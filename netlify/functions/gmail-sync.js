// ESM Netlify function (esbuild bundler)
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  const debug = /debug=1/.test(event.rawQuery || '');
  const log = [];
  const say = (m, extra) => { const line = extra ? `${m} ${JSON.stringify(extra)}` : m; log.push(line); console.log(line); };

  try {
    say('stage: start');

    // 1) Get the newest email account row (single-user friendly)
    const { data: acctRows, error: acctErr } = await admin
      .from('email_accounts')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (acctErr) throw acctErr;
    if (!acctRows || !acctRows.length) {
      return json(400, { error: 'No connected email account found. Connect Gmail first.' });
    }

    const acct = acctRows[0];
    if (!acct.user_id) throw new Error('email_accounts.user_id is null; run the backfill step.');

    say('account', { provider: acct.provider, email: acct.email_address, user_id: acct.user_id });

    // 2) Prepare OAuth2 client
    const oauth2 = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // set credentials; googleapis will refresh if you include a refresh_token
    oauth2.setCredentials({
      access_token: acct.access_token || undefined,
      refresh_token: acct.refresh_token || undefined,
      expiry_date: acct.expires_at ? new Date(acct.expires_at).getTime() : undefined,
      token_type: acct.token_type || undefined,
      scope: acct.scope || undefined,
    });

    // force an access token to be present (refresh if needed)
    let token;
    try {
      token = await oauth2.getAccessToken();
      say('access token acquired');
    } catch (e) {
      say('access token refresh failed', { err: String(e) });
      throw new Error('Failed to refresh Gmail token — reconnect Gmail.');
    }

    // Update stored token metadata if google refreshed it
    const newCreds = oauth2.credentials || {};
    if (newCreds.access_token || newCreds.expiry_date || newCreds.scope || newCreds.token_type) {
      const { error: updErr } = await admin
        .from('email_accounts')
        .update({
          access_token: newCreds.access_token ?? acct.access_token ?? null,
          token_type: newCreds.token_type ?? acct.token_type ?? null,
          scope: newCreds.scope ?? acct.scope ?? null,
          // google stores ms epoch; our column is timestamptz
          expires_at: newCreds.expiry_date ? new Date(newCreds.expiry_date).toISOString() : acct.expires_at ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', acct.id);
      if (updErr) say('warning: failed to persist refreshed token', { updErr });
    }

    // 3) Gmail fetch
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });

    // a pragmatic query; tweak as you like
    const q = 'newer_than:30d (subject:order OR subject:shipment OR subject:tracking)';
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 100,
    });

    const msgIds = (listRes.data.messages || []).map((m) => m.id);
    say('gmail list', { count: msgIds.length });

    // 4) Fetch and normalize each message
    const rawRows = [];
    for (const id of msgIds) {
      try {
        const mRes = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        });
        const m = mRes.data;
        const headers = Object.fromEntries(
          (m.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value])
        );

        const subject = headers['subject'] || '';
        const dateStr = headers['date'] || null;
        const from = headers['from'] || '';
        let fromName = null, fromEmail = null;
        const match = from.match(/^(?:"?([^"]*)"?\s)?<?([^<>]+@[^<>]+)>?$/);
        if (match) {
          fromName = (match[1] || '').trim() || null;
          fromEmail = (match[2] || '').trim() || null;
        } else {
          fromEmail = from || null;
        }

        // body_plain fallback
        let bodyRaw = '', bodyHtml = '';
        const parts = [];
        const walk = (p) => {
          if (!p) return;
          if (p.body?.data) parts.push({ mime: p.mimeType, data: p.body.data });
          (p.parts || []).forEach(walk);
        };
        walk(m.payload);
        for (const p of parts) {
          const buf = Buffer.from(p.data, 'base64').toString('utf8');
          if (p.mime?.includes('text/html')) bodyHtml += buf;
          else bodyRaw += buf;
        }

        rawRows.push({
          user_id: acct.user_id,
          message_id: m.id,
          thread_id: m.threadId || null,
          from_name: fromName,
          from_email: fromEmail,
          subject,
          date: dateStr ? new Date(dateStr).toISOString() : null,
          snippet: m.snippet || null,
          headers,
          body_raw: bodyRaw || null,
          body_html: bodyHtml || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        say('fetch one message failed', { id, err: String(e) });
      }
    }

    // 5) Upsert into email_raw (no RPC)
    if (rawRows.length) {
      const { error: upErr } = await admin
        .from('email_raw')
        .upsert(rawRows, { onConflict: 'user_id,message_id' });
      if (upErr) throw upErr;
      say('upsert email_raw', { count: rawRows.length });
    } else {
      say('no messages to upsert');
    }

    // 6) Very small demo parse (optional). Improve later as needed.
    const ordersToInsert = [];
    const shipsToInsert = [];
    for (const r of rawRows) {
      const subj = (r.subject || '').toLowerCase();
      const body = [r.body_raw || '', r.body_html || '', r.snippet || ''].join('\n').toLowerCase();

      // Order-like
      if (subj.includes('order') || body.includes('order')) {
        // naive retailer + total extraction
        const retailer = (r.from_email || '').split('@')[1]?.split('.')[0] || null;
        const totalMatch = body.match(/\b\$\s?([0-9]+(?:\.[0-9]{2})?)\b/);
        const totalCents = totalMatch ? Math.round(parseFloat(totalMatch[1]) * 100) : null;

        ordersToInsert.push({
          user_id: r.user_id,
          retailer,
          order_id: null,
          order_date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
          currency: 'USD',
          total_cents: totalCents,
          source_message_id: r.message_id,
          created_at: new Date().toISOString(),
        });
      }

      // Shipment-like
      if (subj.includes('shipped') || subj.includes('shipment') || body.includes('tracking')) {
        const retailer = (r.from_email || '').split('@')[1]?.split('.')[0] || null;
        const tracking = (body.match(/\b(1Z[0-9A-Z]{16,})\b/) // UPS
          || body.match(/\b(\d{12,})\b/) // USPS/FedEx generic
          || [null, null])[1];

        shipsToInsert.push({
          user_id: r.user_id,
          retailer,
          order_id: null,
          carrier: null,
          tracking_number: tracking,
          status: null,
          shipped_at: r.date || null,
          delivered_at: null,
          source_message_id: r.message_id,
          created_at: new Date().toISOString(),
        });
      }
    }

    if (ordersToInsert.length) {
      const { error: oErr } = await admin.from('email_orders').insert(ordersToInsert);
      if (oErr) say('warning: email_orders insert failed', { oErr });
      else say('inserted email_orders', { count: ordersToInsert.length });
    }
    if (shipsToInsert.length) {
      const { error: sErr } = await admin.from('email_shipments').insert(shipsToInsert);
      if (sErr) say('warning: email_shipments insert failed', { sErr });
      else say('inserted email_shipments', { count: shipsToInsert.length });
    }

    const summary = {
      imported: rawRows.length,
      orders_guessed: ordersToInsert.length,
      shipments_guessed: shipsToInsert.length,
      debug: debug ? log : undefined,
    };
    return json(200, summary);
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err?.message || err), debug: debug ? log : undefined });
  }
}
