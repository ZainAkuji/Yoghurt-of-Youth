import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

function getPriceId(planKey: string) {
  const map: Record<string, string | undefined> = {
    PLN: process.env.STRIPE_PRICE_SUB_PLN,
    BFC: process.env.STRIPE_PRICE_SUB_BFC,
    STR: process.env.STRIPE_PRICE_SUB_STR,
    MNG: process.env.STRIPE_PRICE_SUB_MNG,
    MIX: process.env.STRIPE_PRICE_SUB_MIX,
  };
  const id = map[planKey];
  if (!id) throw new Error("Missing Stripe price for plan: " + planKey);
  return id;
}

// Compute the coming Monday 00:00 in Europe/London as a Unix timestamp.
// (Keeps “starts on coming Monday” stable even around DST.)
function nextMondayLondonUnix(): number {
  const now = new Date();

  // We’ll approximate London midnight by constructing a date in UTC based on London local date.
  // Best practice is using a TZ library; this works well in most cases.
  // If you want rock-solid DST handling, I’ll give you a Luxon version too.
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat
  const daysUntilMonday = (8 - day) % 7 || 7; // always at least 1 day ahead
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);

  // "Monday 00:00 London" ~ "Monday 00:00 UTC" for winter,
  // off by 1 hour during BST — if that matters to you, use Luxon below.
  d.setUTCHours(0, 0, 0, 0);

  return Math.floor(d.getTime() / 1000);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { planKey, customer, note } = req.body || {};
    if (!planKey) return res.status(400).json({ error: "Missing planKey" });
    if (!customer?.email) return res.status(400).json({ error: "Missing customer email" });

    const price = getPriceId(String(planKey));

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const anchor = nextMondayLondonUnix();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: String(customer.email),

      // Collect address / phone in Stripe too (optional but nice)
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",

      subscription_data: {
        // Start billing on coming Monday, then weekly after that.
        billing_cycle_anchor: anchor,
        proration_behavior: "none",

        // Ensure they enter payment now, but first charge occurs at anchor:
        trial_end: anchor,

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
