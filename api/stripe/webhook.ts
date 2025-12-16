console.log("🚀 Stripe webhook hit");

import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Stripe requires raw body + signature verification.
  // BUT: Vercel's Node functions don't give raw body by default like Next bodyParser=false.
  // Easiest production-safe solution on Vercel: use Stripe's "constructEvent" with raw buffer we read ourselves.

  const sig = req.headers["stripe-signature"];
  if (!sig || Array.isArray(sig)) return res.status(400).send("Missing signature");

  try {
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    console.log("✅ Event verified:", event.type);

    // ✅ idempotency: dedupe on event.id (recommended)
    const dedupeKey = `stripe:event:${event.id}`;
    const already = await kv.get(dedupeKey);
    if (already) return res.status(200).json({ received: true, deduped: true });
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 14 }); // 14 days

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const m = session.metadata || {};

      console.log("📦 Session metadata:", session.metadata);

      let orderLines = "";
      try {
        orderLines = JSON.parse(m.order_lines || "[]").join("\n");
      } catch {
        orderLines = String(m.order_lines || "");
      }

      // Build your EmailJS template params (same keys you use everywhere)
      const templateParams = {
        brand: "Yoghurt of Youth",
        owner_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",

        customer_name: m.customer_name || "",
        customer_email: m.customer_email || "",
        customer_phone: m.customer_phone || "",
        customer_address: m.customer_address || "",

        delivery_date: m.delivery_date || "",
        delivery_window: m.delivery_window || "",
        note: m.note || "",

        order_id: m.order_id || "",
        payment_method: "Stripe",

        order_lines: m.order_lines || "",
        bottles: m.bottles || "",
        yoghurt_strain: m.yoghurt_strain || "",

        plain_qty: m.plain_qty || "",
        flav_qty: m.flav_qty || "",
        plain_bundles: m.plain_bundles || "",
        flav_bundles: m.flav_bundles || "",
        plain_remainder: m.plain_remainder || "",
        flav_remainder: m.flav_remainder || "",

        merchandise_total: m.merchandise_total || "",
        delivery_fee: m.delivery_fee || "",
        total_paid: m.total_paid || "",

        subject: `Yoghurt of Youth order – ${m.delivery_date} – ${m.customer_name} – ${m.order_id}`,
      };
  
      // 1) owner email
      console.log("📧 Sending OWNER email");

      await sendEmailJS(process.env.EMAILJS_TEMPLATE_ID as string, {
        ...templateParams,
        to_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",
      });
      
      // 2) customer email
      console.log("📧 Sending CUSTOMER email");

      if (m.customer_email) {
        await sendEmailJS(process.env.EMAILJS_CUSTOMER_TEMPLATE_ID as string, {
          ...templateParams,
          to_email: m.customer_email,
        });
      }
    }
    
    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err?.message || err);
    return res.status(400).send("Webhook Error");
  }
}

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
