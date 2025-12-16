import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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

  const text = await r.text();
  console.log("EmailJS response:", r.status, text);

  if (!r.ok) {
    throw new Error(`EmailJS failed: ${r.status} ${text}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sig = req.headers["stripe-signature"];
  if (!sig || Array.isArray(sig)) return res.status(400).send("Missing signature");

  try {
    const rawBody = await readRawBody(req);

    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const m = session.metadata || {};

      let orderLinesPretty = "";
      try {
        orderLinesPretty = JSON.parse(m.order_lines || "[]").join("\n");
      } catch {
        orderLinesPretty = String(m.order_lines || "");
      }

      const deliveryWeekday = m.delivery_date ? weekdayFromDMY(m.delivery_date) : "";
      const deliveryDatePretty = deliveryWeekday
        ? `${deliveryWeekday} ${m.delivery_date}`
        : (m.delivery_date || "");

      const templateParams = {
        brand: "Yoghurt of Youth",
        owner_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",

        customer_name: m.customer_name || "",
        customer_email: m.customer_email || "",
        customer_phone: m.customer_phone || "",
        customer_address: m.customer_address || "",

        delivery_date: deliveryDatePretty,
        delivery_window: m.delivery_window || "",
        note: m.note || "",

        order_id: m.order_id || "",
        payment_method: "Stripe",

        order_lines: orderLinesPretty,
        bottles: m.bottles || "",
        yoghurt_strain: m.yoghurt_strain || "",

        plain_qty: m.plain_qty || "",
        flav_qty: m.flav_qty || "",
        plain_bundles: m.plain_bundles || "",
        flav_bundles: m.flav_bundles || "",
        plain_remainder: m.plain_remainder || "",
        flav_remainder: m.flav_remainder || "",

        merchandise_total: fmtGbp(m.merchandise_total),
        delivery_fee: fmtGbp(m.delivery_fee),
        total_paid: fmtGbp(m.total_paid),
      };

      await sendEmailJS(process.env.EMAILJS_TEMPLATE_ID as string, {
        ...templateParams,
        to_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",
      });

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
