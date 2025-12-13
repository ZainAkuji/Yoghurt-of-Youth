import Stripe from "stripe";
import { sendEmail } from "../../utils/emailjs-server";

export const config = {
  api: { bodyParser: false },
};

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const m = session.metadata || {};

    try {
      await sendEmail({
        brand: "Yoghurt of Youth",

        customer_name: m.customer_name,
        customer_email: m.customer_email,
        customer_phone: m.customer_phone,
        customer_address: m.customer_address,

        delivery_date: m.delivery_date,
        delivery_window: m.delivery_window,

        order_lines: JSON.parse(m.order_lines || "[]").join("\n"),
        bottles: m.bottles,
        total_paid: `£${m.total_paid}`,

        payment_method: "Card (Stripe)",
        order_id: m.order_id,
      });
    } catch (e) {
      console.error("EmailJS failed:", e);
    }
  }

  res.json({ received: true });
}

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
