import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";
import { sendEmail } from "../../utils/emailjs-server";

// IMPORTANT: disable body parsing for Stripe
export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Stripe webhook signature verification failed:", err.message);
    return res.status(400).send("Webhook Error");
  }

  // ✅ We only care about successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const m = session.metadata || {};

    try {
      await sendEmail({
        // EmailJS template variables
        brand: "Yoghurt of Youth",
        owner_email: process.env.OWNER_EMAIL || "support@yoghurtofyouth.co.uk",

        customer_name: m.customer_name,
        customer_email: m.customer_email,
        customer_phone: m.customer_phone,
        customer_address: m.customer_address,

        delivery_date: m.delivery_date,
        delivery_window: m.delivery_window,

        order_lines: m.order_lines,
        bottles: m.bottles,
        plain_qty: m.plain_qty,
        flav_qty: m.flav_qty,
        plain_bundles: m.plain_bundles,
        flav_bundles: m.flav_bundles,
        plain_remainder: m.plain_remainder,
        flav_remainder: m.flav_remainder,

        merchandise_total: m.merchandise_total,
        delivery_fee: m.delivery_fee,
        total_paid: m.total_paid,

        payment_method: "Stripe",
        order_id: m.order_id,
        note: m.note || "",
      });

      console.log("✅ Stripe confirmation email sent:", m.order_id);
    } catch (emailErr) {
      console.error("❌ Failed to send Stripe email:", emailErr);
    }
  }

  res.json({ received: true });
}

// ---- raw body helper ----
function buffer(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
