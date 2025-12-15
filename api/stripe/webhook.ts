import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmailJS } from "../../utils/emailjs-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const m = session.metadata || {};

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
      if (m.customer_email) {
        await sendEmailJS(process.env.EMAILJS_CUSTOMER_TEMPLATE_ID as string, {
          ...templateParams,
          to_email: m.customer_email,
        });
      }

      await sendEmailJS(process.env.EMAILJS_TEMPLATE_ID as string, {
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
        yoghurt_strain: custom.yoghurt_strain || "",

        plain_qty: m.plain_qty || "",
        flav_qty: m.flav_qty || "",
        plain_bundles: m.plain_bundles || "",
        flav_bundles: m.flav_bundles || "",
        plain_remainder: m.plain_remainder || "",
        flav_remainder: m.flav_remainder || "",

        merchandise_total: m.merchandise_total || "",
        delivery_fee: m.delivery_fee || "",
        total_paid: m.total_paid || "",

        subject: `Yoghurt of Youth order – ${custom.delivery_date} – ${custom.customer_name} – ${custom.order_id}`,

        to_email: process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk",
      });
    }

    if (m.customer_email) {
      await sendEmailJS(process.env.EMAILJS_CUSTOMER_TEMPLATE_ID as string, {
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

        plain_qty: m.plain_qty || "",
        flav_qty: m.flav_qty || "",
        plain_bundles: m.plain_bundles || "",
        flav_bundles: m.flav_bundles || "",
        plain_remainder: m.plain_remainder || "",
        flav_remainder: m.flav_remainder || "",

        merchandise_total: m.merchandise_total || "",
        delivery_fee: m.delivery_fee || "",
        total_paid: m.total_paid || "",
        
        to_email: m.customer_email,
      });
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
