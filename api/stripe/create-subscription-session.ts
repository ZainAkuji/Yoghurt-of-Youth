// /api/stripe/create-subscription-session.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover",
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

/**
 * "Coming Monday" anchor as a Unix timestamp (seconds).
 * - Always the next Monday (if today is Monday, it anchors to next week's Monday).
 * - Midnight UTC is fine for “weekly on Monday” billing; keeps code simple.
 */
function nextMondayUnix(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat
  const daysUntilMonday = ((8 - day) % 7) || 7; // always at least 1 day ahead

  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);

  return Math.floor(d.getTime() / 1000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { planKey, customer, note } = (req.body || {}) as {
      planKey?: string;
      customer?: { name?: string; email?: string; phone?: string; address?: string };
      note?: string;
    };

    if (!planKey) return res.status(400).json({ error: "Missing planKey" });
    if (!customer?.email) return res.status(400).json({ error: "Missing customer email" });

    const price = getPriceId(String(planKey));
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const anchor = nextMondayUnix();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: String(customer.email),

      // Keep it simple: collect in Stripe too (fine even if you already collect in your modal)
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",

      subscription_data: {
        // Weekly recurring payment every Monday.
        billing_cycle_anchor: anchor,
        proration_behavior: "none",

        // Customer pays now (sets up payment method), first charge happens on the anchor.
        // (Stripe will treat this as a trial until the anchor.)
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
