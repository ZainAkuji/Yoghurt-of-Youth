import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// If your totals are in GBP pounds (e.g. 12.50), convert to pence (1250)
function poundsToPence(amount: number) {
  return Math.round(Number(amount || 0) * 100);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const { cart, totals, customer, delivery_date, delivery_window, note, lines } = req.body as {
      cart: Record<string, number>;
      totals: any;
      customer: { name: string; email: string; phone: string; address: string };
      delivery_date: string;
      delivery_window: string;
      note?: string;
      lines?: string[]; // optional: let frontend send pretty lines
    };

    if (!cart || !totals || !customer?.email) {
      return res.status(400).json({ error: "Missing required checkout data." });
    }

    // ✅ Your computeTotals looks like pounds (because you do gbp(total) in UI)
    const totalPounds = Number(totals.total || 0);
    const amountPence = poundsToPence(totalPounds);

    if (amountPence < 50) {
      return res.status(400).json({ error: "Total too small." });
    }

    // Lines: either provided from client (preferred), or fallback to ids
    const orderLines: string[] =
      Array.isArray(lines) && lines.length
        ? lines
        : Object.entries(cart).map(([id, qty]) => `${id} × ${qty}`);

    const orderId = `YOY-${Date.now().toString().slice(-6)}`;

    // ✅ Keep metadata small (Stripe metadata values are short strings)
    const metadata: Stripe.MetadataParam = {
      // for EmailJS template
      brand: "Yoghurt of Youth",
      owner_email: process.env.OWNER_EMAIL || "support@yoghurtofyouth.co.uk",

      customer_name: customer.name || "",
      customer_email: customer.email || "",
      customer_phone: customer.phone || "",
      customer_address: customer.address || "",

      delivery_date: delivery_date || "",
      delivery_window: delivery_window || "",
      note: note || "",

      // order summary fields used by your EmailJS template
      order_lines: JSON.stringify(orderLines).slice(0, 480), // safety cap
      bottles: String(totals.qtyTotal ?? ""),
      plain_qty: String(totals.plainQty ?? ""),
      flav_qty: String(totals.flavQty ?? ""),
      plain_bundles: String(totals.plainBundles ?? ""),
      flav_bundles: String(totals.flavBundles ?? ""),
      plain_remainder: String(totals.plainRemainder ?? ""),
      flav_remainder: String(totals.flavRemainder ?? ""),
      merchandise_total: String(totals.merchTotal ?? ""),
      delivery_fee: String(totals.deliveryFee ?? ""),
      total_paid: String(totals.total ?? ""),

      // internal id you like
      order_id: orderId,

      // if you pass this from client, include it; otherwise blank
      yoghurt_strain: String(totals.deliveryBrand || ""),
    };

    // ✅ Build one Stripe line item: "Yoghurt of Youth order"
    // (You can expand this later to multiple items; this is the simplest stable approach.)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer.email,

      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Yoghurt of Youth",
              description: orderLines.join(", ").slice(0, 500),
            },
            unit_amount: amountPence,
          },
          quantity: 1,
        },
      ],

      metadata,

      // Send them back to your site after payment/cancel
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?paid=1&provider=stripe`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?paid=0&provider=stripe`,
    });

    return res.status(200).json({
      url: session.url,
      id: session.id,     // so your persistPendingOrder("stripe", data.id) works
      orderId,            // optional, useful to show customer
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
