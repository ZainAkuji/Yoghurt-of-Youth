import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { sendOrderEmail } from "../../../utils/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { stripeSession, paypalOrder } = req.body;

    let metadata: any = null;

    // ---- STRIPE ----
    if (stripeSession) {
      const session = await stripe.checkout.sessions.retrieve(stripeSession);
      metadata = session.metadata;
    }

    // (Optional) PayPal resolution can be added here

    if (!metadata) {
      return res.status(400).json({ error: "Could not load order metadata" });
    }

    const order = {
      ...metadata,
      lines: JSON.parse(metadata.lines),
    };

    await sendOrderEmail(order);

    return res.status(200).json(order);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
