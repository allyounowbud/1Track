// netlify/functions/email-normalize.js
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- helpers ----------
const parseDateISO = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const classify = (subject = "", snippet = "") => {
  const S = (subject + " " + snippet).toLowerCase();
  if (/your order|order confirmation|thanks for your order|order #|order no|we received your order/.test(S)) {
    return "order_confirmation";
  }
  if (/shipped|on the way|tracking|label created|out for delivery/.test(S)) {
    return "shipping_update";
  }
  if (/delivered|has been delivered|package delivered/.test(S)) {
    return "delivery_confirmation";
  }
  return "other";
};
const detectRetailer = (from_email = "", subject = "") => {
  const dom = (from_email.split("@")[1] || "").toLowerCase();
  if (dom.includes("amazon")) return "Amazon";
  if (dom.includes("ebay")) return "eBay";
  if (dom.includes("walmart")) return "Walmart";
  if (dom.includes("bestbuy")) return "Best Buy";
  if (dom.includes("target")) return "Target";
  const first = (subject || "").split("-")[0].split("|")[0].trim();
  return first || (dom ? dom.replace(/\..+$/, "") : "Unknown");
};
const extractOrderId = (text = "") => {
  const s = String(text);
  const reList = [
    /order\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i,
    /\border\s*#\s*([A-Z0-9\-]+)/i,
    /\b([A-Z0-9]{8,})\b/,
  ];
  for (const re of reList) {
    const m = s.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
};
const extractTotal = (text = "") => {
  const s = String(text);
  const amounts = Array.from(s.matchAll(/\$([0-9][0-9,]*\.?[0-9]{0,2})/g)).map((m) =>
    Number(m[1].replace(/,/g, ""))
  );
  if (!amounts.length) return 0;
  const max = Math.max(...amounts.filter((x) => !isNaN(x)));
  return Math.round(max * 100);
};
const extractTrackingAndCarrier = (text = "") => {
  const s = String(text);
  let m = s.match(/\b1Z[0-9A-Z]{16}\b/i);
  if (m) return { tracking_number: m[0], carrier: "UPS" };
  m = s.match(/\b(\d{12,15})\b/);
  if (m) return { tracking_number: m[1], carrier: "FedEx" };
  m = s.match(/\b(\d{20,22})\b/);
  if (m) return { tracking_number: m[1], carrier: "USPS" };
  if (/ups\.com\/track/i.test(s)) return { tracking_number: null, carrier: "UPS" };
  if (/fedex\.com\/tracking/i.test(s)) return { tracking_number: null, carrier: "FedEx" };
  if (/tools\.usps\.com\/go\/TrackConfirm/i.test(s)) return { tracking_number: null, carrier: "USPS" };
  return { tracking_number: null, carrier: null };
};
async function upsertOrInsert(table, rows, onConflictCols) {
  if (!rows.length) return { count: 0 };
  const { data, error } = await admin
    .from(table)
    .upsert(rows, { onConflict: onConflictCols, ignoreDuplicates: false });
  if (!error) return { count: data ? data.length : rows.length };
  if (!/no unique|exclusion constraint/i.test(error.message || "")) throw error;
  const { data: ins, error: e2 } = await admin.from(table).insert(rows);
  if (e2) throw e2;
  return { count: ins ? ins.length : rows.length };
}

// ---------- handler ----------
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    // who to normalize for (latest connected account)
    const { data: acctRows, error: acctErr } = await admin
      .from("email_accounts")
      .select("user_id, email_address")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (acctErr) throw acctErr;
    if (!acctRows?.length || !acctRows[0].user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: "No connected account/user_id" }) };
    }
    const user_id = acctRows[0].user_id;

    // pull un-normalized RAW emails (NO classification column needed)
    const { data: raws, error: rawErr } = await admin
      .from("email_raw")
      .select("id, user_id, subject, snippet, from_email, date_header, raw_json, normalized_at")
      .eq("user_id", user_id)
      .is("normalized_at", null)
      .limit(500);
    if (rawErr) throw rawErr;

    const orders = [];
    const ships = [];
    const normalizedIds = [];

    for (const r of raws || []) {
      const cls = classify(r.subject, r.snippet); // compute on the fly
      if (!["order_confirmation", "shipping_update", "delivery_confirmation"].includes(cls)) {
        continue;
      }
      const retailer = detectRetailer(r.from_email, r.subject);
      const order_id = extractOrderId(`${r.subject}\n${r.snippet}\n${JSON.stringify(r.raw_json || {})}`);
      const order_date = parseDateISO(r.date_header);
      const total_cents = extractTotal(`${r.subject}\n${r.snippet}`);

      if (cls === "order_confirmation" || (cls !== "order_confirmation" && order_id)) {
        orders.push({
          user_id,
          retailer,
          order_id: order_id || null,
          order_date,
          currency: "USD",
          total_cents: total_cents || 0,
        });
      }

      if (cls === "shipping_update" || cls === "delivery_confirmation") {
        const { tracking_number, carrier } = extractTrackingAndCarrier(
          `${r.subject}\n${r.snippet}\n${JSON.stringify(r.raw_json || {})}`
        );
        const status =
          cls === "delivery_confirmation"
            ? "delivered"
            : /out for delivery/i.test(r.snippet || "")
            ? "out_for_delivery"
            : "in_transit";
        ships.push({
          user_id,
          retailer,
          order_id: order_id || null,
          carrier,
          tracking_number,
          status,
          shipped_at: order_date,
          delivered_at: cls === "delivery_confirmation" ? order_date : null,
        });
      }

      normalizedIds.push(r.id);
    }

    // write rows
    let ordersInserted = 0;
    let shipsInserted = 0;

    if (orders.length) {
      const seen = new Set();
      const dedup = [];
      for (const o of orders) {
        const key = `${o.user_id}|${o.retailer}|${o.order_id || ""}|${o.order_date || ""}|${o.total_cents}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(o);
      }
      const res = await upsertOrInsert("email_orders", dedup, "user_id,retailer,order_id");
      ordersInserted = res.count;
    }

    if (ships.length) {
      const seen = new Set();
      const dedup = [];
      for (const s of ships) {
        const key = `${s.user_id}|${s.tracking_number || ""}|${s.retailer}|${s.order_id || ""}|${s.status}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(s);
      }
      const res = await upsertOrInsert("email_shipments", dedup, "user_id,tracking_number");
      shipsInserted = res.count;
    }

    if (normalizedIds.length) {
      await admin.from("email_raw").update({ normalized_at: new Date().toISOString() }).in("id", normalizedIds);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        orders_inserted: ordersInserted,
        shipments_inserted: shipsInserted,
        processed_raw: normalizedIds.length,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
