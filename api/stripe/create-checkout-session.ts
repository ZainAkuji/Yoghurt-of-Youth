import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed." });

  try {
    const {
      cart,
      totals,
      customer,
      delivery_date,
      delivery_window,
      note,
    } = req.body;

    const { qtyTotal, total, plainQty, flavQty } = totals;

    // Build line descriptions
    const lines = Object.entries(cart).map(([id, qty]) => `${id} × ${qty}`);

    // Metadata (critical for reconstruction on success)
    const metadata = {
      orderId: `YOY-${Date.now().toString().slice(-6)}`,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      delivery_date,
      delivery_window,
      note: note || "",
      qtyTotal: String(qtyTotal),
      plainQty: String(plainQty),
      flavQty: String(flavQty),
      totalText: `£${(total / 100).toFixed(2)}`, // Stripe expects amounts in cents/pence
      lines: JSON.stringify(lines),
    };

    // Create session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${qtyTotal} bottles of yoghurt`,
              description: lines.join(", "),
            },
            unit_amount: total * 100, // Convert £ to pence
          },
        },
      ],
      customer_email: customer.email,
      success_url: `${process.env.NEXT_PUBLIC_DOMAIN}/?paid=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}/?cancelled=1`,
      metadata,
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
