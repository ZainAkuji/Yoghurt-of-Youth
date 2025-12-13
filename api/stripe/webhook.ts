import Stripe from "stripe";
import { sendEmailJS } from "../../../utils/emailjs-server";
import { kv } from "@vercel/kv";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const raw = await buffer(req);
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature error", err);
    return res.status(400).send("Invalid signature");
  }

  // ✅ only act on successful checkout completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const m = session.metadata || {};

    // ✅ idempotency: prevent duplicates
    const dedupeKey = `stripe:event:${event.id}`;
    const already = await kv.get(dedupeKey);
    if (already) return res.json({ received: true, deduped: true });
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 14 }); // keep 14 days

    // Build template params using YOUR EXISTING template field names
    const orderLinesArr = safeJson<string[]>(m.order_lines) || [];
    const templateParams = {
      brand: "Yoghurt of Youth",
      owner_email: process.env.OWNER_EMAIL || "support@yoghurtofyouth.co.uk",

      customer_name: m.customer_name,
      customer_email: m.customer_email,
      customer_phone: m.customer_phone,
      customer_address: m.customer_address,

      delivery_date: m.delivery_date,
      delivery_window: m.delivery_window,

      order_lines: orderLinesArr.join("\n"),
      bottles: m.bottles,
      yoghurt_strain: m.yoghurt_strain || "",

      plain_qty: m.plain_qty,
      flav_qty: m.flav_qty,
      plain_bundles: m.plain_bundles,
      flav_bundles: m.flav_bundles,
      plain_remainder: m.plain_remainder,
      flav_remainder: m.flav_remainder,

      merchandise_total: fmtGbp(m.merchandise_total),
      delivery_fee: fmtGbp(m.delivery_fee),
      total_paid: fmtGbp(m.total_paid),

      payment_method: "Card (Stripe)",
      note: m.note || "",

      order_id: m.order_id || session.id,
      subject: `Yoghurt of Youth order – ${m.delivery_date} – ${m.customer_name} – ${m.order_id || session.id}`,
    };

    // ✅ send to OWNER
    await sendEmailJS(process.env.EMAILJS_TEMPLATE_ID_OWNER!, {
      ...templateParams,
      to_email: process.env.OWNER_EMAIL || "support@yoghurtofyouth.co.uk",
      reply_to: m.customer_email,
    });

    // ✅ send to CUSTOMER
    await sendEmailJS(process.env.EMAILJS_TEMPLATE_ID_CUSTOMER!, {
      ...templateParams,
      to_email: m.customer_email,
      reply_to: process.env.OWNER_EMAIL || "support@yoghurtofyouth.co.uk",
    });
  }

  res.json({ received: true });
}

function safeJson<T>(s: any): T | null {
  try {
    return JSON.parse(String(s || ""));
  } catch {
    return null;
  }
}

function fmtGbp(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return String(v || "");
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
