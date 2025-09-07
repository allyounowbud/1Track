// netlify/functions/gmail-sync.js
// Pull commerce emails from Gmail, store raw, normalize to orders/shipments, link intelligently.

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} = process.env;

// --------------------------- helpers ---------------------------
const okJson = (body) => ({
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const errJson = (status, body) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function getBearerJwt(headers) {
  const h = headers?.authorization || headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m ? m[1] : null;
}

function pickHeader(payload, name) {
  const h = payload?.headers || [];
  const f = h.find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
  return f?.value || null;
}

function parseInternalDate(ms) {
  if (!ms) return null;
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}

function toIsoOrNull(v) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// Retailer mapping from From: header domain / display name keywords
function detectRetailer(fromStr = "", subject = "") {
  const s = (fromStr + " " + subject).toLowerCase();
  const map = [
    ["amazon", "Amazon"],
    ["walmart", "Walmart"],
    ["target", "Target"],
    ["bestbuy", "Best Buy"],
    ["ebay", "eBay"],
    ["stockx", "StockX"],
    ["nike", "Nike"],
    ["adidas", "Adidas"],
    ["homedepot", "Home Depot"],
    ["lowe", "Lowe's"],
    ["costco", "Costco"],
    ["etsy", "Etsy"],
    ["apple", "Apple"],
    ["gamestop", "GameStop"],
    ["shopify", "Shopify"],
  ];
  for (const [needle, label] of map) {
    if (s.includes(needle)) return label;
  }
  // Fallback: extract display part before <...>
  const m = /^(.*?)</.exec(fromStr);
  if (m && m[1]) return m[1].trim();
  return null;
}

// Basic commerce classification
function classify(subject = "", snippet = "") {
  const s = (subject || "").toLowerCase();
  const body = (snippet || "").toLowerCase();
  const t = s + " " + body;

  // Strict delivery first
  if (t.includes("delivered") || t.includes("has been delivered") || t.includes("was delivered")) {
    return { type: "delivery", status: "delivered" };
  }
  // Out for delivery
  if (t.includes("out for delivery")) {
    return { type: "shipment", status: "out_for_delivery" };
  }
  // Shipped / on the way
  if (t.includes("shipped") || t.includes("on the way") || t.includes("your package is on the way") || t.includes("label created")) {
    if (t.includes("label created")) return { type: "shipment", status: "label_created" };
    return { type: "shipment", status: "in_transit" };
  }
  // Order confirmation
  if (
    t.includes("order confirmation") ||
    t.includes("thanks for your order") ||
    t.includes("we received your order") ||
    t.includes("order number") ||
    t.includes("order #") ||
    t.startsWith("order ")
  ) {
    return { type: "order" };
  }

  // Ignore promos/social/etc
  return { type: "other" };
}

// Extract order id from subject/snippet; avoid tracking numbers
function extractOrderId(text = "") {
  const s = text.replace(/\s+/g, " ");

  // Amazon-like 3-part
  const amz = /(\d{3}-\d{7}-\d{7})/i.exec(s);
  if (amz) return amz[1];

  // "Order #XYZ-12345" or "Order XYZ123"
  const hash = /order\s*(number|no\.|#)?[:\s\-]*([A-Z0-9\-]{5,})/i.exec(s);
  if (hash) {
    const candidate = hash[2];
    // Filter obvious tracking formats so we don't misassign
    if (!looksLikeTracking(candidate)) return candidate;
  }

  // Fallback: nothing
  return null;
}

// Extract carrier + tracking
function looksLikeTracking(str = "") {
  // UPS
  if (/^1Z[0-9A-Z]{16}$/i.test(str)) return true;
  // USPS (20-22 / 26-34 digits; many start with 94 / 92 / 93)
  if (/^\d{20,34}$/.test(str)) return true;
  // FedEx common 12/14/15/20 digits
  if (/^\d{12,20}$/.test(str)) return true;
  return false;
}

function extractTrackingAndCarrier(text = "") {
  const t = text.replace(/\s+/g, " ").toUpperCase();

  // UPS
  const ups = /\b1Z[0-9A-Z]{16}\b/.exec(t);
  if (ups) return { tracking: ups[0], carrier: "UPS" };

  // FedEx (12-20 digits). Use hints to avoid order ids.
  const fedex = /\b(\d{12}|\d{14}|\d{15}|\d{20})\b/.exec(t);
  if (fedex && (t.includes("FEDEX") || t.includes("TRACK"))) {
    return { tracking: fedex[0], carrier: "FedEx" };
  }

  // USPS (20-34 digits). Use hint words
  const usps = /\b\d{20,34}\b/.exec(t);
  if (usps && (t.includes("USPS") || t.includes("TRACK"))) {
    return { tracking: usps[0], carrier: "USPS" };
  }

  // DHL 10 digits (very loose)
  const dhl = /\b\d{10}\b/.exec(t);
  if (dhl && (t.includes("DHL") || t.includes("TRACK"))) {
    return { tracking: dhl[0], carrier: "DHL" };
  }

  return { tracking: null, carrier: null };
}

// Money extraction (very loose)
function extractTotalCents(text = "") {
  const m = /\$([0-9]{1,6}(?:\.[0-9]{2})?)/.exec(text);
  if (!m) return null;
  const dollars = parseFloat(m[1]);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

// --------------------------- Gmail search query ---------------------------
// Focus on commerce: orders & shipping
function buildQuery(days = 120) {
  // newer_than is Gmail's relative filter; reduce noise with category/label negations
  const terms = [
    '(' +
      [
        'subject:"order confirmation"',
        '"thanks for your order"',
        '"we received your order"',
        '"order number"',
        '"order #"',
        "shipped",
        '"on the way"',
        '"out for delivery"',
        "delivered",
        '"tracking number"',
        '"label created"',
      ].join(" OR ") +
    ')',
    "-in:chats",
    "-category:social",
    "-category:promotions",
    `newer_than:${days}d`,
  ];
  return terms.join(" ");
}

// -------------------- Supabase admin client (server-side) --------------------
function sbAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

// Try to determine the user whose mailbox to sync.
// Priority: x-user-id header -> Authorization Bearer (sub) -> only/most-recent account.
async function resolveUserIdAndAccount(admin, evt) {
  const hdr = evt.headers || {};
  const explicit = hdr["x-user-id"] || hdr["X-User-Id"];
  if (explicit) {
    const { data, error } = await admin
      .from("email_accounts")
      .select("*")
      .eq("user_id", explicit)
      .eq("provider", "gmail")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (!error && data && data[0]) return { userId: explicit, account: data[0] };
  }

  const jwt = getBearerJwt(hdr);
  if (jwt) {
    try {
      // decode sub without verifying (header.payload.signature)
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1] || "", "base64").toString("utf8"));
      const sub = payload?.sub;
      if (sub) {
        const { data, error } = await admin
          .from("email_accounts")
          .select("*")
          .eq("user_id", sub)
          .eq("provider", "gmail")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (!error && data && data[0]) return { userId: sub, account: data[0] };
      }
    } catch {
      /* ignore decode */
    }
  }

  // Fallback: take most recent Gmail account (single-user dev convenience)
  const { data, error } = await admin
    .from("email_accounts")
    .select("*")
    .eq("provider", "gmail")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || !data[0]) throw new Error("No connected Gmail account found.");
  return { userId: data[0].user_id, account: data[0] };
}

// --------------------------- main handler ---------------------------
export const handler = async (event) => {
  const debug = [];
  try {
    // GET or POST is fine
    const admin = sbAdmin();

    // Identify user + account
    const { userId, account } = await resolveUserIdAndAccount(admin, event);
    debug.push(`account ${JSON.stringify({ provider: account.provider, email: account.email_address, user_id: userId })}`);

    // Ensure client credentials
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return errJson(500, { error: "Missing Google OAuth env (client id/secret)" });
    }

    // Prepare OAuth client
    const oauth2 = new google.auth.OAuth2({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    });

    // Refresh token if expired/near expiry
    let { access_token, refresh_token, expires_at } = account;
    const nowSec = Math.floor(Date.now() / 1000);
    const needsRefresh = !access_token || !expires_at || (expires_at - 60) <= nowSec;

    if (needsRefresh) {
      if (!refresh_token) {
        return errJson(400, { error: "Missing refresh_token; reconnect Gmail." });
      }
      const tokenResp = await oauth2.getToken({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
      });
      access_token = tokenResp.tokens.access_token;
      const expiry = tokenResp.tokens.expiry_date ? Math.floor(tokenResp.tokens.expiry_date / 1000) : nowSec + 3500;
      expires_at = expiry;

      await admin
        .from("email_accounts")
        .update({ access_token, expires_at })
        .eq("id", account.id);
    }

    oauth2.setCredentials({ access_token, refresh_token });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    debug.push("access token acquired");

    // --------------------- List relevant messages ---------------------
    const days = Number(event.queryStringParameters?.days || 120);
    const limit = Math.max(1, Math.min(500, Number(event.queryStringParameters?.limit || 100)));
    const q = buildQuery(days);

    let pageToken = undefined;
    let ids = [];
    let pages = 0;

    while (ids.length < limit && pages < 5) {
      const list = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: Math.min(100, limit - ids.length),
        pageToken,
      });
      const msgs = list.data.messages || [];
      ids.push(...msgs.map((m) => m.id));
      pageToken = list.data.nextPageToken;
      pages++;
      if (!pageToken) break;
    }

    debug.push(`gmail list ${JSON.stringify({ count: ids.length })}`);

    // --------------------- Fetch + UPSERT raw ---------------------
    const newlySeen = [];
    for (const id of ids) {
      const full = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      const payload = full.data?.payload || {};
      const subject = pickHeader(payload, "Subject") || "";
      const fromH = pickHeader(payload, "From") || "";
      const toH = pickHeader(payload, "To") || "";
      const dateH = pickHeader(payload, "Date");
      const internal = parseInternalDate(full.data?.internalDate);
      const snippet = full.data?.snippet || "";

      const row = {
        id, // important: email_raw.id must be unique/PK
        user_id: userId,
        thread_id: full.data?.threadId || null,
        subject,
        from_header: fromH,
        to_header: toH,
        date_header: toIsoOrNull(dateH),
        internal_date: internal,
        snippet,
        // defer classification/normalized_at so we can reclassify in code below
      };

      // upsert raw
      const { error } = await admin
        .from("email_raw")
        .upsert(row, { onConflict: "id" });
      if (error && error.code !== "23505") {
        // 23505 = unique violation; safe to ignore
        throw error;
      }

      // detect whether this was new by checking normalized_at/classification
      const { data: existing } = await admin
        .from("email_raw")
        .select("classification, normalized_at")
        .eq("id", id)
        .single();

      if (!existing?.classification || !existing?.normalized_at) {
        newlySeen.push({ id, subject, fromH, snippet, dateIso: row.date_header || row.internal_date });
      }
    }

    // --------------------- Classify & Normalize ---------------------
    let normOrders = 0;
    let normShips = 0;

    // Pull the set we need to normalize (freshly fetched and any stale ones)
    const { data: toNormalize, error: normSelErr } = await admin
      .from("email_raw")
      .select("*")
      .eq("user_id", userId)
      .is("normalized_at", null)
      .limit(400);
    if (normSelErr) throw normSelErr;

    for (const m of toNormalize) {
      const { type, status } = classify(m.subject, m.snippet);
      const retailer = detectRetailer(m.from_header, m.subject);
      const textBlob = [m.subject || "", m.snippet || ""].join("  ");

      let orderId = null;
      let tracking = null;
      let carrier = null;

      if (type === "order") {
        orderId = extractOrderId(textBlob);
      } else if (type === "shipment" || type === "delivery") {
        const t = extractTrackingAndCarrier(textBlob);
        tracking = t.tracking;
        carrier = t.carrier;
        orderId = extractOrderId(textBlob); // sometimes present alongside tracking
      }

      // Insert/Upsert into orders/shipments accordingly
      if (type === "order") {
        const orderRow = {
          user_id: userId,
          retailer: retailer || null,
          order_id: orderId || null,
          order_date: m.date_header || m.internal_date || new Date().toISOString(),
          currency: null,
          total_cents: extractTotalCents(textBlob),
        };

        // require at least retailer OR order_id to avoid garbage rows
        if (orderRow.retailer || orderRow.order_id) {
          const { error: upErr } = await admin
            .from("email_orders")
            .upsert(orderRow, { onConflict: "user_id,retailer,order_id" });
          if (upErr) throw upErr;
          normOrders++;
        }
      }

      if (type === "shipment" || type === "delivery") {
        const shipped_at =
          type === "shipment" ? (m.date_header || m.internal_date) : null;
        const delivered_at =
          (type === "delivery" || status === "delivered") ? (m.date_header || m.internal_date) : null;

        // If we have a tracking number, use tracking uniqueness; else fall back to (user, retailer, order_id)
        const shipRow = {
          user_id: userId,
          retailer: retailer || null,
          order_id: orderId || null,
          carrier: carrier || null,
          tracking_number: tracking || null,
          status: status || (type === "delivery" ? "delivered" : "in_transit"),
          shipped_at,
          delivered_at,
        };

        if (shipRow.tracking_number) {
          // Upsert by (user_id, tracking_number): update status/dates
          const { error: upErr } = await admin
            .from("email_shipments")
            .upsert(shipRow, { onConflict: "user_id,tracking_number" });
          if (upErr) throw upErr;
          normShips++;
        } else if (shipRow.retailer || shipRow.order_id) {
          // Less precise, but keep 1 per (user, retailer, order)
          const { error: upErr } = await admin
            .from("email_shipments")
            .upsert(shipRow, { onConflict: "user_id,retailer,order_id" });
          if (upErr && upErr.code !== "23505") throw upErr;
          normShips++;
        }

        // Try to link shipments to an existing order using order_id or retailer proximity
        if (!shipRow.order_id && shipRow.tracking_number) {
          // attempt to discover matching order by retailer and recent date window
          const { data: maybeOrders } = await admin
            .from("email_orders")
            .select("order_id, retailer, order_date")
            .eq("user_id", userId)
            .gte("order_date", new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString())
            .lte("order_date", new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString())
            .limit(50);

          // pick the closest retailer match if any
          const match = (maybeOrders || []).find(
            (o) => shipRow.retailer && o.retailer && o.retailer.toLowerCase() === shipRow.retailer.toLowerCase()
          );
          if (match) {
            await admin
              .from("email_shipments")
              .update({ retailer: match.retailer, order_id: match.order_id })
              .eq("user_id", userId)
              .eq("tracking_number", shipRow.tracking_number);
          }
        }
      }

      // Mark normalized
      const { error: doneErr } = await admin
        .from("email_raw")
        .update({
          classification: type,
          normalized_at: new Date().toISOString(),
        })
        .eq("id", m.id);
      if (doneErr) throw doneErr;
    }

    return okJson({
      imported: newlySeen.length,
      normalized_orders: normOrders,
      normalized_shipments: normShips,
      skipped_existing: ids.length - newlySeen.length,
      limit_used: ids.length,
      pages_used: Math.ceil(ids.length / 100),
      debug,
    });
  } catch (e) {
    return errJson(500, { error: e.message || String(e), debug });
  }
};
