import { kv } from "@vercel/kv";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { api: { bodyParser: true } };

function weekdayFromDMY(dmy: string) {
  // expects "dd/mm/yyyy"
  const [d, m, y] = dmy.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { weekday: "long" }); // Monday/Thursday etc
}

function fmtGbp(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? "");
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

type EmailPayload = Record<string, any>;

async function sendEmailJS(templateId: string, templateParams: EmailPayload) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !publicKey || !privateKey) {
    throw new Error("Missing EmailJS env vars (SERVICE_ID / PUBLIC_KEY / PRIVATE_KEY).");
  }

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

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`EmailJS failed: ${r.status} ${text}`);
  }
}

// helper: fetch access token
async function paypalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET_KEY}`
  ).toString("base64");

  const tokenResp = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(data?.error_description || "PayPal token failed");
  return data.access_token as string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1) verify signature
  try {
    const access_token = await paypalAccessToken();

    const verifyResp = await fetch("https://api-m.paypal.com/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: req.headers["paypal-auth-algo"],
        cert_url: req.headers["paypal-cert-url"],
        transmission_id: req.headers["paypal-transmission-id"],
        transmission_sig: req.headers["paypal-transmission-sig"],
        transmission_time: req.headers["paypal-transmission-time"],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID, // you set this in env
        webhook_event: req.body,
      }),
    });

    const verify = await verifyResp.json();
    if (verify?.verification_status !== "SUCCESS") {
      console.error("PayPal webhook signature failed", verify);
      return res.status(400).send("Invalid signature");
    }
  } catch (e) {
    console.error("PayPal verify error", e);
    return res.status(400).send("Webhook verification error");
  }

  const event = req.body;
  const eventType = event?.event_type;

  // We only email when money is actually captured
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    // idempotency
    const dedupeKey = `paypal:event:${event.id}`;
    const already = await kv.get(dedupeKey);
    if (already) return res.json({ received: true, deduped: true });
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 14 });

    // capture object includes "custom_id" at purchase unit level in most cases.
    // Sometimes you may need to fetch order details by "supplementary_data.related_ids.order_id".
    const pu = event?.resource?.supplementary_data?.related_ids?.order_id
      ? null
      : null;

    // Best source: order_id is often present here:
    const paypalOrderId =
      event?.resource?.supplementary_data?.related_ids?.order_id ||
      "";

    let custom: any = null;

    // If PayPal doesn't include purchase_unit custom_id in the webhook payload,
    // we fetch the order details to read custom_id reliably.
    if (paypalOrderId) {
      try {
        const access_token = await paypalAccessToken();
        const orderResp = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${paypalOrderId}`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const order = await orderResp.json();
        const customRaw = order?.purchase_units?.[0]?.custom_id || "";
        try { custom = JSON.parse(customRaw); } catch { custom = null; }
      } catch (e) {
        console.error("Failed to fetch PayPal order for custom_id", e);
      }
    }

    if (!custom) {
      console.error("No custom_id metadata found for PayPal webhook");
      return res.json({ received: true, warning: "no_custom_id" });
    }

    // Build your EmailJS template params (same keys you use everywhere)
    const templateParams = {
      brand: "Yoghurt of Youth",
      owner_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",

      customer_name: custom.customer_name,
      customer_email: custom.customer_email,
      customer_phone: custom.customer_phone,
      customer_address: custom.customer_address,

      delivery_date: custom.delivery_date,
      delivery_window: custom.delivery_window,
      note: custom.note || "",

      order_id: custom.order_id || paypalOrderId,
      payment_method: "PayPal",

      order_lines: custom.order_lines,
      bottles: custom.bottles,
      yoghurt_strain: custom.yoghurt_strain || "",

      plain_qty: custom.plain_qty,
      flav_qty: custom.flav_qty,
      plain_bundles: custom.plain_bundles,
      flav_bundles: custom.flav_bundles,
      plain_remainder: custom.plain_remainder,
      flav_remainder: custom.flav_remainder,

      merchandise_total: fmtGbp(custom.merchandise_total),
      delivery_fee: fmtGbp(custom.delivery_fee),
      total_paid: fmtGbp(custom.total_paid),

      subject: `Yoghurt of Youth order – ${custom.delivery_date} – ${custom.customer_name} – ${custom.order_id || paypalOrderId}`,
    };

    // 1) owner email
    await sendEmailJS(process.env.EMAILJS_TEMPLATE_ID as string, {
      ...templateParams,
      to_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",
    });
    
    // 2) customer email
    if (custom.customer_email) {
      await sendEmailJS(process.env.EMAILJS_CUSTOMER_TEMPLATE_ID as string, {
        ...templateParams,
        to_email: custom.customer_email,
      });
    }
  }

  return res.json({ received: true });
}

function fmtGbp(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return String(v || "");
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

