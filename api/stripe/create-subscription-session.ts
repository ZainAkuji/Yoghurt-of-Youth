import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function getPriceId(planKey: string) {
  const map: Record<string, string | undefined> = {
    PLN: process.env.STRIPE_PRICE_SUB_PLN,
    BFC: process.env.STRIPE_PRICE_SUB_BFC,
    STR: process.env.STRIPE_PRICE_SUB_STR,
    MNG: process.env.STRIPE_PRICE_SUB_MNG,
    MIX: process.env.STRIPE_PRICE_SUB_MIX,
  };
  const id = map[String(planKey)];
  if (!id) throw new Error("Missing Stripe price for plan: " + planKey);
  return id;
}

// Next Monday 18:30 Europe/London-ish as a unix timestamp.
// (No trial_end. We anchor billing to Monday.)
function nextMondayAnchorUnix(): number {
  const now = new Date();

  // Start from today's date at 00:00
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay(); // 0..6
  let add = (8 - day) % 7;
  if (add === 0) add = 7; // always coming Monday

  d.setDate(d.getDate() + add);

  // set to 18:30 local server time (good enough for your use case)
  d.setHours(18, 30, 0, 0);

  return Math.floor(d.getTime() / 1000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { planKey, customer, note } = req.body || {};
    if (!planKey) return res.status(400).json({ error: "Missing planKey" });
    if (!customer?.email) return res.status(400).json({ error: "Missing customer email" });

    const price = getPriceId(String(planKey));
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const anchor = nextMondayAnchorUnix();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: String(customer.email),

      phone_number_collection: { enabled: true },
      billing_address_collection: "required",

      subscription_data: {
        billing_cycle_anchor: anchor,
        proration_behavior: "none",
        metadata: {
          kind: "weekly_gut_punch",
          planKey: String(planKey),
          name: String(customer.name || ""),
          phone: String(customer.phone || ""),
          address: String(customer.address || ""),
          note: String(note || ""),
        },
      },

      success_url: `${siteUrl}/?pay=success&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?pay=cancel&provider=stripe`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
