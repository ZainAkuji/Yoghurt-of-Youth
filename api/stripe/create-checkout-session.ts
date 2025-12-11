import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, orderId } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Yoghurt of Youth order #${orderId}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_DOMAIN}/success?orderId=${orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}/cancel`,
      metadata: {
        orderId,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: "Stripe checkout error" });
  }
}
