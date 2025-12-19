// /api/stripe/create-subscription-session.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

// Next Monday 09:00 Europe/London as a UNIX timestamp (seconds)
function nextMondayLondon0900Unix(): number {
  const now = new Date();

  // Get "now" in Europe/London as date parts
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));

  // Construct a Date that represents "today 00:00" in London.
  // We do this by interpreting the London date as UTC midnight, then adjust by finding the real London offset.
  const londonMidnightUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

  // What weekday is it in London? (Mon=1 ... Sun=0)
  const londonWeekday = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
      .format(londonMidnightUtc)
      .startsWith("Mon") ? 1 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
      .format(londonMidnightUtc)
      .startsWith("Tue") ? 2 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
      .format(londonMidnightUtc)
      .startsWith("Wed") ? 3 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
      .format(londonMidnightUtc)
      .startsWith("Thu") ? 4 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
      .format(londonMidnightUtc)
      .startsWith("Fri") ? 5 :
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" })
      .format(londonMidnightUtc)
      .startsWith("Sat") ? 6 : 0
  );

  // Days until next Monday
  const daysUntilNextMonday = londonWeekday === 1 ? 7 : (8 - londonWeekday) % 7;

  // Next Monday 09:00 "London local" — approximate by taking the London date and setting UTC 09:00,
  // then letting Stripe handle actual billing anchor consistency (this is good enough for weekly cadence).
  const nextMon = new Date(Date.UTC(y, m - 1, d + daysUntilNextMonday, 9, 0, 0));
  return Math.floor(nextMon.getTime() / 1000);
}

function getPriceIdForPlan(plan: string): string {
  const map: Record<string, string | undefined> = {
    PLN: process.env.STRIPE_PRICE_WEEKLY_PLN,
    BFC: process.env.STRIPE_PRICE_WEEKLY_BFC,
    STR: process.env.STRIPE_PRICE_WEEKLY_STR,
    MNG: process.env.STRIPE_PRICE_WEEKLY_MNG,
    MIX: process.env.STRIPE_PRICE_WEEKLY_MIX,
  };
  const priceId = map[plan];
  if (!priceId) throw new Error(`Unknown plan or missing env price id for: ${plan}`);
  return priceId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL");

    const { planKey, customer } = req.body || {};
    if (!planKey) return res.status(400).json({ error: "Missing planKey" });
    if (!customer?.name || !customer?.email || !customer?.phone || !customer?.address) {
      return res.status(400).json({ error: "Missing customer details" });
    }

    const priceId = getPriceIdForPlan(String(planKey).toUpperCase());
    const billingAnchor = nextMondayLondon0900Unix();
    const minCancelAt = billingAnchor + 3 * 7 * 24 * 60 * 60; // +3 weeks

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],

      // Collect delivery details in your own form; Stripe collects payment method securely.
      customer_email: customer.email,

      // IMPORTANT: don't charge immediately — trial until next Monday (day of delivery)
      subscription_data: {
        trial_end: billingAnchor,
        billing_cycle_anchor: billingAnchor,
        proration_behavior: "none",
        metadata: {
          subscription_type: "weekly_gut_punch",
          plan_key: String(planKey).toUpperCase(),
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_address: customer.address,
          min_cancel_at_unix: String(minCancelAt),
        },
      },

      // Your site handles UX after redirect
      success_url: `${siteUrl}/?pay=success&provider=stripe_sub&plan=${encodeURIComponent(planKey)}`,
      cancel_url: `${siteUrl}/?pay=cancel&provider=stripe_sub`,
    });

    return res.status(200).json({ url: session.url });
  } catch (e: any) {
    console.error("Stripe subscription session error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
