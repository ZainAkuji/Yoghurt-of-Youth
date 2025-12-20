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
  const id = map[planKey];
  if (!id) throw new Error("Missing Stripe price for plan: " + planKey);
  return id;
}

function nextEligibleMondayUnix(): number {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  const TWO_DAYS_SEC = 2 * 24 * 60 * 60;

  const now = new Date();

  // Start from "today at 18:30 UTC"
  const d = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    18, 30, 0, 0
  ));

  // Find next Monday (always in the future)
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat
  let daysUntilMonday = (8 - day) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);

  let anchor = Math.floor(d.getTime() / 1000);

  // Stripe: trial_end must be >= 2 days in the future
  if (anchor < nowSec + TWO_DAYS_SEC) {
    d.setUTCDate(d.getUTCDate() + 7);
    anchor = Math.floor(d.getTime() / 1000);
  }

  return anchor;
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

    const anchor = nextEligibleMondayUnix();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: String(customer.email),

      phone_number_collection: { enabled: true },
      billing_address_collection: "required",

      subscription_data: {
        // Take payment method now, first charge at anchor, then weekly from there
        trial_end: anchor,
        proration_behavior: "none",

        metadata: {
          kind: "weekly_gut_punch",
          planKey: String(planKey),
          name: String(customer?.name || ""),
          phone: String(customer?.phone || ""),
          address: String(customer?.address || ""),
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
