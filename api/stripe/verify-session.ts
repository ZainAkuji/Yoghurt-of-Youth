import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session_id = String(req.query.session_id || "");
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const paid = session.payment_status === "paid";

    // IMPORTANT: use whatever key you actually store in metadata
    const order_id =
      session.metadata?.orderId ||
      session.metadata?.order_id ||
      session.id; // fallback so you always have something

    return res.status(200).json({ paid, order_id });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Stripe verify failed" });
  }
}
