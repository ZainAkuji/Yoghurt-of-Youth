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
      mode: "payment",
      // ...
      customer_email: customer.email,
    
      metadata: {
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address,
        delivery_date,
        delivery_window,
        note: note || "",
        order_lines: JSON.stringify(
          Object.entries(cart).map(([id, qty]) => {
            const p = PRODUCTS.find((x) => x.id === id);
            return `${p?.name ?? id} × ${qty}`;
          })
        ),
        bottles: String(totals.qtyTotal),
        plain_qty: String(totals.plainQty),
        flav_qty: String(totals.flavQty),
        plain_bundles: String(totals.plainBundles),
        flav_bundles: String(totals.flavBundles),
        plain_remainder: String(totals.plainRemainder),
        flav_remainder: String(totals.flavRemainder),
        merchandise_total: String(totals.merchTotal),
        delivery_fee: String(totals.deliveryFee),
        total_paid: String(totals.total),
    
        // if you have this computed elsewhere, pass it in
        yoghurt_strain: String(totals.deliveryBrand || ""),
      },
    });


    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
