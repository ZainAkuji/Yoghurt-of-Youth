import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

function weekdayFromDMY(dmy: string) {
  const [d, m, y] = String(dmy).split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { weekday: "long" });
}

function fmtGbp(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? "");
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function h(req: VercelRequest, name: string) {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

type EmailPayload = Record<string, any>;

async function sendEmailJS(templateId: string, templateParams: EmailPayload) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !publicKey || !privateKey) {
    console.error("Missing EmailJS env vars");
    return; // fail silently
  }
  try {
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: templateParams,
      }),
    });
    const text = await r.text();
    console.log("EmailJS response:", r.status, text);
    if (!r.ok) throw new Error(`EmailJS failed: ${r.status} ${text}`);
  } catch (err) {
    console.error("EmailJS send failed:", err);
    // Do not throw — allow webhook to return 200
  }
}

async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;
  if (!clientId || !secret) throw new Error("Missing PayPal env vars");
  const PAYPAL_BASE =
    process.env.PAYPAL_ENV === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const tokenResp = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(data?.error_description || "PayPal token failed");
  return { access_token: data.access_token as string, PAYPAL_BASE };
}

function prettyOrderLines(v: any) {
  try {
    if (Array.isArray(v)) return v.join("\n");
    const parsed = JSON.parse(v ?? "[]");
    if (Array.isArray(parsed)) return parsed.join("\n");
    return String(v ?? "");
  } catch {
    return String(v ?? "");
  }
}

// Create Redis client once using your active STORAGE2 variables
const redis = new Redis({
  url: process.env.STORAGE2_KV_REST_API_URL || "",
  token: process.env.STORAGE2_KV_REST_API_TOKEN || "",
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  // 1) Verify PayPal signature
  let PAYPAL_BASE = "https://api-m.paypal.com";
  try {
    const { access_token, PAYPAL_BASE: base } = await paypalAccessToken();
    PAYPAL_BASE = base;
    const verifyResp = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: h(req, "paypal-auth-algo"),
        cert_url: h(req, "paypal-cert-url"),
        transmission_id: h(req, "paypal-transmission-id"),
        transmission_sig: h(req, "paypal-transmission-sig"),
        transmission_time: h(req, "paypal-transmission-time"),
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: req.body,
      }),
    });
    const verify = await verifyResp.json();
    if (!verifyResp.ok) {
      console.error("PayPal verify request failed:", verify);
      return res.status(400).send("Webhook verification request failed");
    }
    if (verify?.verification_status !== "SUCCESS") {
      console.error("PayPal webhook signature failed:", verify);
      return res.status(400).send("Invalid signature");
    }
  } catch (e) {
    console.error("PayPal verify error", e);
    return res.status(400).send("Webhook verification error");
  }

  const event = req.body;
  const eventType = event?.event_type;

  // Only process completed captures
  if (eventType !== "PAYMENT.CAPTURE.COMPLETED") {
    return res.json({ received: true, ignored: true, eventType });
  }

  // Extract PayPal order id
  const paypalOrderId = event?.resource?.supplementary_data?.related_ids?.order_id || "";
  let custom: any = null;
  let orderRef = "";

  // Fetch order to read custom_id
  if (paypalOrderId) {
    try {
      const { access_token } = await paypalAccessToken();
      const orderResp = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const order = await orderResp.json();
      if (!orderResp.ok) {
        console.error("PayPal order fetch failed:", order);
      } else {
        orderRef =
          String(order?.purchase_units?.[0]?.custom_id || "") ||
          String(order?.purchase_units?.[0]?.reference_id || "");
      }
    } catch (e) {
      console.error("Failed to fetch PayPal order", e);
    }
  }

  if (!orderRef) {
    console.error("No orderRef found", { paypalOrderId });
    return res.json({ received: true, warning: "no_order_ref" });
  }

  // Load full payload from Redis
  try {
    custom = await redis.get(`paypal_order_${orderRef}`);
  } catch (e) {
    console.error("Redis read failed for PayPal orderRef", orderRef, e);
    custom = null;
  }

  if (!custom) {
    console.error("No payload found for PayPal webhook", { orderRef, paypalOrderId });
    return res.json({ received: true, warning: "no_kv_payload" });
  }

  const deliveryWeekday = custom.delivery_date ? weekdayFromDMY(custom.delivery_date) : "";
  const deliveryDatePretty = deliveryWeekday ? `${deliveryWeekday} ${custom.delivery_date}` : (custom.delivery_date || "");

  const templateParams = {
    brand: "Yoghurt of Youth",
    owner_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",
    customer_name: custom.customer_name || "",
    customer_email: custom.customer_email || "",
    customer_phone: custom.customer_phone || "",
    customer_address: custom.customer_address || "",
    is_collection: custom.delivery_method === "collection" ? "1" : "",
    delivery_date: deliveryDatePretty,
    delivery_window: custom.delivery_window || "",
    note: custom.note || "",
    order_id: custom.order_id || paypalOrderId,
    payment_method: "PayPal",
    order_lines: prettyOrderLines(custom.order_lines),
    bottles: String(custom.bottles ?? ""),
    yoghurt_strain: String(custom.yoghurt_strain ?? ""),
    plain_qty: String(custom.plain_qty ?? ""),
    flav_qty: String(custom.flav_qty ?? ""),
    plain_bundles: String(custom.plain_bundles ?? ""),
    flav_bundles: String(custom.flav_bundles ?? ""),
    plain_remainder: String(custom.plain_remainder ?? ""),
    flav_remainder: String(custom.flav_remainder ?? ""),
    merchandise_total: fmtGbp(custom.merchandise_total),
    delivery_fee: fmtGbp(custom.delivery_fee),
    total_paid: fmtGbp(custom.total_paid),
  };

  // Gift code marking
  const giftCode = String(custom.gift_code || "").trim().toUpperCase();
  const giftStrQty = Number(custom.gift_str_qty || 0);
  const emailKey = String(custom.customer_email || "").trim().toLowerCase();

  if (giftStrQty > 0 && giftCode && emailKey) {
    const usedKey = `yoy_gift_used:${giftCode}:${emailKey}`;
    await redis.set(usedKey, {
      order_id: custom.order_id || orderRef || paypalOrderId || "",
      paypal_order_id: paypalOrderId || "",
      usedAt: Date.now(),
    }, { ex: 60 * 60 * 24 * 30 }); // 30 days
  }

  // Send emails
  const ownerTpl = process.env.EMAILJS_TEMPLATE_ID as string;
  const custTpl = process.env.EMAILJS_CUSTOMER_TEMPLATE_ID as string;

  if (ownerTpl) {
    await sendEmailJS(ownerTpl, {
      ...templateParams,
      to_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",
    });
  }
  if (custom.customer_email && custTpl) {
    await sendEmailJS(custTpl, {
      ...templateParams,
      to_email: custom.customer_email,
    });
  }

  return res.json({ received: true });
}

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
