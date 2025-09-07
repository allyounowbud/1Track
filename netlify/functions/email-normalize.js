// netlify/functions/email-normalize.js
import { createClient } from '@supabase/supabase-js';

// ---------- helpers ----------
const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const currencyFrom = (s = '') => {
  if (/[€]/.test(s)) return { sym: '€', code: 'EUR' };
  if (/[£]/.test(s)) return { sym: '£', code: 'GBP' };
  return { sym: '$', code: 'USD' }; // default
};

const toCents = (amtStr = '') => {
  const n = Number(String(amtStr).replace(/[^0-9.]/g, ''));
  return Math.round((isFinite(n) ? n : 0) * 100);
};

const mapDomainToRetailer = (fromAddr = '') => {
  const m = fromAddr.toLowerCase().match(/@([^>\s;]+)/);
  const domain = m?.[1] || '';
  const map = {
    'amazon.com': 'Amazon',
    'amazon.ca': 'Amazon',
    'ebay.com': 'eBay',
    'walmart.com': 'Walmart',
    'target.com': 'Target',
    'bestbuy.com': 'Best Buy',
    'apple.com': 'Apple',
    'microcenter.com': 'Micro Center',
    'newegg.com': 'Newegg',
    'bhphotovideo.com': 'B&H',
    'homedepot.com': 'Home Depot',
    'lowes.com': 'Lowe’s',
    'etsy.com': 'Etsy',
    'shopify.com': 'Shopify',
  };
  for (const d of Object.keys(map)) if (domain.endsWith(d)) return map[d];
  return null;
};

// very loose order id finder
const findOrderId = (text = '') => {
  // Common patterns: "Order # 123-1234567-1234567", "Order Number: 987654"
  const rxes = [
    /order[\s#:-]*([A-Z0-9\-]{5,})/i,
    /order\s*number[\s#:-]*([A-Z0-9\-]{5,})/i,
    /\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/, // Amazon-like
  ];
  for (const rx of rxes) {
    const m = text.match(rx);
    if (m?.[1]) return m[1].trim();
  }
  return null;
};

// loose total extractor (prefers lines with "total", otherwise first currency)
const findTotal = (subject = '', snippet = '') => {
  const pick = (s) => {
    const currencyPref = /(?:total|grand total|amount|order total)[^\n$£€]*([$£€]\s?\d[\d,]*(?:\.\d{2})?)/i;
    const firstMoney = /([$£€]\s?\d[\d,]*(?:\.\d{2})?)/;
    let m = s.match(currencyPref);
    if (!m) m = s.match(firstMoney);
    if (m?.[1]) return m[1];
    return null;
  };
  return pick(subject) || pick(snippet) || null;
};

// carrier + tracking
const findCarrier = (text = '') => {
  const s = text.toLowerCase();
  if (s.includes('ups')) return 'UPS';
  if (s.includes('usps')) return 'USPS';
  if (s.includes('fedex')) return 'FedEx';
  if (s.includes('dhl')) return 'DHL';
  if (s.includes('lasership')) return 'LaserShip';
  if (s.includes('ontrac')) return 'OnTrac';
  return null;
};

const findTracking = (text = '') => {
  // Very approximate; good enough for MVP:
  // UPS: 1Z + 16 alnum
  const ups = /(1Z[0-9A-Z]{16})/i;
  // FedEx (12-15 digits)
  const fedex = /\b(\d{12,15})\b/;
  // USPS: long 20-22 digits often starting 92 / 94 / 927...
  const usps = /\b(9\d{19,21})\b/;

  for (const rx of [ups, usps, fedex]) {
    const m = text.match(rx);
    if (m?.[1]) return m[1];
  }
  return null;
};

// ---------- parser ----------
function parseRow(r) {
  const subject = r.subject || '';
  const snippet = r.snippet || '';
  const from = r.from_addr || '';
  const hint = r.raw_json?.event_hint || null;

  const merged = `${subject}\n${snippet}`;

  const retailer = mapDomainToRetailer(from);
  const orderId = findOrderId(merged);

  if (hint === 'order') {
    const moneyStr = findTotal(subject, snippet);
    const { sym, code } = currencyFrom(moneyStr || merged);
    const totalC = toCents(moneyStr || '');
    return {
      type: 'order',
      retailer: retailer || null,
      order_id: orderId,
      currency: code,
      total_cents: totalC || 0,
      order_date: r.date_header || null,
    };
  }

  if (hint === 'shipment' || hint === 'delivery') {
    const carrier = findCarrier(merged);
    const tracking = findTracking(merged);
    return {
      type: 'shipment',
      retailer: retailer || null,
      order_id: orderId,
      carrier: carrier,
      tracking_number: tracking,
      status: hint === 'delivery' ? 'delivered' : 'in_transit',
      shipped_at: r.date_header || null,
      delivered_at: hint === 'delivery' ? (r.date_header || null) : null,
    };
  }

  return null;
}

// ---------- handler ----------
export const handler = async () => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Pull recent raw emails (we keep it bounded)
    const { data: raws, error: rawErr } = await admin
      .from('email_raw')
      .select('id, user_id, subject, snippet, from_addr, date_header, raw_json')
      .order('date_header', { ascending: false })
      .limit(1000);

    if (rawErr) throw rawErr;

    let ordersInserted = 0;
    let shipmentsInserted = 0;
    let processed = 0;
    let skipped = 0;

    for (const r of raws) {
      const parsed = parseRow(r);
      if (!parsed) { skipped++; continue; }
      processed++;

      if (parsed.type === 'order') {
        // basic sanity
        if (!(parsed.order_id || parsed.total_cents)) { skipped++; continue; }

        // dedupe by (retailer, order_id) when order_id present; else by (retailer, order_date, total_cents)
        let exists = false;
        if (parsed.order_id) {
          const { data: ex1, error: exErr1 } = await admin
            .from('email_orders')
            .select('id')
            .eq('order_id', parsed.order_id)
            .maybeSingle();
          if (exErr1) throw exErr1;
          exists = !!ex1;
        } else {
          const { data: ex2, error: exErr2 } = await admin
            .from('email_orders')
            .select('id')
            .eq('retailer', parsed.retailer)
            .eq('order_date', parsed.order_date)
            .eq('total_cents', parsed.total_cents)
            .maybeSingle();
          if (exErr2) throw exErr2;
          exists = !!ex2;
        }
        if (exists) { skipped++; continue; }

        const row = {
          retailer: parsed.retailer,
          order_id: parsed.order_id,
          order_date: parsed.order_date,
          currency: parsed.currency || 'USD',
          total_cents: parsed.total_cents || 0,
        };
        const { error: insErr } = await admin.from('email_orders').insert(row, { returning: 'minimal' });
        if (insErr) throw insErr;
        ordersInserted++;
      }

      if (parsed.type === 'shipment') {
        // need at least a tracking or an order_id to be useful
        if (!(parsed.tracking_number || parsed.order_id)) { skipped++; continue; }

        // dedupe by tracking when available, else by (retailer, order_id, status)
        let exists = false;
        if (parsed.tracking_number) {
          const { data: ex1, error: exErr1 } = await admin
            .from('email_shipments')
            .select('id')
            .eq('tracking_number', parsed.tracking_number)
            .maybeSingle();
          if (exErr1) throw exErr1;
          exists = !!ex1;
        } else {
          const { data: ex2, error: exErr2 } = await admin
            .from('email_shipments')
            .select('id')
            .eq('retailer', parsed.retailer)
            .eq('order_id', parsed.order_id)
            .eq('status', parsed.status)
            .maybeSingle();
          if (exErr2) throw exErr2;
          exists = !!ex2;
        }
        if (exists) { skipped++; continue; }

        const row = {
          retailer: parsed.retailer,
          order_id: parsed.order_id,
          carrier: parsed.carrier,
          tracking_number: parsed.tracking_number,
          status: parsed.status,
          shipped_at: parsed.shipped_at,
          delivered_at: parsed.delivered_at,
        };
        const { error: insErr } = await admin.from('email_shipments').insert(row, { returning: 'minimal' });
        if (insErr) throw insErr;
        shipmentsInserted++;
      }
    }

    return json(200, { processed, orders_inserted: ordersInserted, shipments_inserted: shipmentsInserted, skipped });
  } catch (e) {
    console.error(e);
    return json(500, { error: String(e.message || e) });
  }
};
