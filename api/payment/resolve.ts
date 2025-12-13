import Stripe from "stripe";
import type { NextApiRequest, NextApiResponse } from "next";
import { sendOrderEmail } from "../../../utils/email"; // helper we write next

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { stripeSession, paypalOrder } = req.body;

    let metadata: any;

    if (stripeSession) {
      const session = await stripe.checkout.sessions.retrieve(stripeSession, {
        expand: ["payment_intent"],
      });
      metadata = session.metadata;
    }

    // (You may also check PayPal orders here if you want)

    if (!metadata) {
      return res.status(400).json({ error: "No order metadata found." });
    }

    // Send confirmation email (server-side)
    await sendOrderEmail(metadata);

    return res.status(200).json(metadata);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
