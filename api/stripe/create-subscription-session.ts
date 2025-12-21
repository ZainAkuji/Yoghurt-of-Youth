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

// Returns a Date object that represents "now" in Europe/London wall-clock.
// (Good enough for your use-case; keeps Monday logic aligned with London.)
function nowInLondon(): Date {
  return new Date(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(new Date())
      // "dd/mm/yyyy, HH:MM:SS" -> "dd/mm/yyyy HH:MM:SS"
      .replace(",", "")
  );
}

// Next Monday 18:30, BUT if today is Sunday, start Monday-after-next.
function nextMondayAnchorUnixLondon(): number {
  const nowLon = nowInLondon();

  // Start from today's date at 00:00 (London wall clock)
  const d = new Date(nowLon);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay(); // 0=Sun .. 6=Sat

  // Coming Monday normally:
  // - Mon -> +7
  // - Tue -> +6
  // ...
  // - Sun -> +1  (BUT we override to +8 per your rule)
  let addDays = (8 - day) % 7;
  if (addDays === 0) addDays = 7;

  // If subscribing on Sunday, skip tomorrow and start the Monday after next
  if (day === 0) addDays = 8;

  d.setDate(d.getDate() + addDays);

  // 18:30 delivery window start
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

    const anchor = nextMondayAnchorUnixLondon();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: String(customer.email),

      phone_number_collection: { enabled: true },
      billing_address_collection: "required",

      subscription_data: {
        // First charge at next Monday 18:30 (or Monday-after-next if Sunday)
        billing_cycle_anchor: anchor,

        // Prevent Stripe from charging a prorated amount immediately
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
