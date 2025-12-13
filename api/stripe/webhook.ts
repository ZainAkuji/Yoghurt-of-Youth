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
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature error", err);
    return res.status(400).send("Invalid signature");
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;

    const metadata = s.metadata;

    await sendEmail({
      brand: metadata.method === "stripe" ? "Stripe" : "Unknown",
      name: metadata.name,
      email: metadata.email,
      phone: metadata.phone,
      address: metadata.address,
      date: metadata.date,
      window: metadata.deliveryWindow,
      lines: JSON.parse(metadata.orderLines),
      qty: metadata.qtyTotal,
      total: metadata.total,
      orderId: s.id,
      paymentMethod: "Card (Stripe)",
    });
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

