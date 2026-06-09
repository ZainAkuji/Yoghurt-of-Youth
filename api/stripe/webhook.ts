import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_API_KEY as string;

import crypto from "crypto";

const META_PIXEL_ID = "2464598340648858";
const META_CAPI_TOKEN = process.env.META_CAPI_ACCESS_TOKEN as string;

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const normEmail = (e: string) => String(e || "").trim().toLowerCase();
const normPhone = (p: string) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "44" + d.slice(1); // UK
  return d;
};

async function sendMetaPurchaseCAPI(opts: { orderId: string; email?: string; phone?: string; value: number }) {
  if (!META_CAPI_TOKEN) return;
  try {
    const user_data: Record<string, any> = {};
    if (opts.email) user_data.em = [sha256(normEmail(opts.email))];
    if (opts.phone) user_data.ph = [sha256(normPhone(opts.phone))];

    const payload = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id: opts.orderId, // <-- same ID as the browser pixel Purchase
        user_data,
        custom_data: { currency: "GBP", value: opts.value || 0 },
      }],
    };

    const r = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    if (!r.ok) console.error("CAPI Purchase error:", JSON.stringify(await r.json()));
  } catch (e) {
    console.error("CAPI Purchase failed:", e);
  }
}

export const config = {
  api: { bodyParser: false },
};

function weekdayFromDMY(dmy: string) {
  const [d, m, y] = dmy.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { weekday: "long" });
}

function fmtGbp(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? "");
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function formatDateUKFromUnixSeconds(unixSeconds: number) {
  if (!unixSeconds || !isFinite(unixSeconds)) return "";
  const d = new Date(unixSeconds * 1000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  return `${dd}/${mm}/${yyyy} (${weekday})`;
}

function safeJoinAddress(addr: any) {
  if (!addr || typeof addr !== "object") return "";
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.state,
    addr.postal_code,
    addr.country,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return parts.join(", ");
}

function subscriptionLinesFromPlanKey(planKey: string) {
  const key = String(planKey || "").toUpperCase();
  if (key === "MIX") {
    return ["Weekly box: 2× BFC, 3× STR, 2× MNG (7 bottles)"];
  }
  if (key) {
    return [`Weekly box: 7× ${key} (7 bottles)`];
  }
  return ["Weekly box (7 bottles)"];
}

type EmailPayload = Record<string, any>;

async function sendEmailJS(templateId: string, templateParams: EmailPayload) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !publicKey || !privateKey) {
    console.error("Missing EmailJS env vars");
    return; // fail silently to avoid blocking webhook response
  }
  try {
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: templateParams,
      }),
    });
    const text = await r.text();
    console.log("EmailJS response:", r.status, text);
    if (!r.ok) throw new Error(`EmailJS failed: ${r.status} ${text}`);
  } catch (err) {
    console.error("EmailJS send failed:", err);
    // Do not throw — allow webhook to return 200 to Stripe
  }
}

// Create Redis client once (using your active STORAGE2 vars)
const redis = new Redis({
  url: process.env.STORAGE2_KV_REST_API_URL || "",
  token: process.env.STORAGE2_KV_REST_API_TOKEN || "",
});

async function alreadyProcessedOnce(key: string) {
  try {
    const hit = await redis.get(key);
    if (hit) return true;
    await redis.set(key, "1", { ex: 60 * 60 * 24 * 7 }); // 7 days expiry
    return false;
  } catch (e) {
    console.warn("Redis idempotency check failed:", e);
    return false; // fail open — better to send email than block
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const sig = req.headers["stripe-signature"];
  if (!sig || Array.isArray(sig)) return res.status(400).send("Missing signature");

  try {
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    // Idempotency per Stripe event id
    const idKey = `stripe_webhook_done:${event.id}`;
    if (await alreadyProcessedOnce(idKey)) {
      return res.status(200).json({ received: true, deduped: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const ownerEmail = process.env.OWNER_EMAIL || "zainul_a@hotmail.co.uk";

      // SUBSCRIPTION (Weekly Gut Punch)
      if (session.mode === "subscription") {
        const subId = typeof session.subscription === "string" ? session.subscription : "";
        let sub: Stripe.Subscription | null = null;
        if (subId) {
          sub = await stripe.subscriptions.retrieve(subId);
        }
        const sm = sub?.metadata || {};
        const planKey = String(sm.planKey || "");
        const linesArr = subscriptionLinesFromPlanKey(planKey);

        let weeklyPriceText = "";
        try {
          const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
          const first = li.data?.[0];
          const unitAmount = first?.price?.unit_amount;
          const currency = (first?.price?.currency || "gbp").toUpperCase();
          if (typeof unitAmount === "number") {
            const v = unitAmount / 100;
            weeklyPriceText =
              currency === "GBP"
                ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v)
                : `${v.toFixed(2)} ${currency}`;
          }
        } catch (e) {
          console.warn("Could not read subscription line items:", e);
        }

        const cd = session.customer_details || {};
        const customer_name = String((sm as any).name || (cd as any).name || "");
        const customer_email = String((cd as any).email || session.customer_email || "");
        const customer_phone = String((sm as any).phone || (cd as any).phone || "");
        const customer_address = String((sm as any).address || "") || safeJoinAddress((cd as any).address) || "";

        const firstDelivery = sub?.trial_end ? formatDateUKFromUnixSeconds(sub.trial_end) : "";

        const templateParams = {
          brand: "Yoghurt of Youth",
          owner_email: ownerEmail,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          order_id: subId || session.id || "",
          payment_method: "Stripe (Subscription)",
          delivery_date: firstDelivery,
          delivery_window: "18:30–20:00",
          bottles: 7,
          total_paid: weeklyPriceText || "",
          merchandise_total: "",
          delivery_fee: "FREE",
          order_lines: linesArr.join("\n"),
          note: String(sm.note || ""),
        };

        const ownerTpl = process.env.EMAILJS_TEMPLATE_SUB_OWNER as string;
        const custTpl = process.env.EMAILJS_TEMPLATE_SUB_CUSTOMER as string;

        if (ownerTpl) {
          await sendEmailJS(ownerTpl, { ...templateParams, to_email: ownerEmail });
        }
        if (customer_email && custTpl) {
          await sendEmailJS(custTpl, { ...templateParams, to_email: customer_email });
        }

        return res.status(200).json({ received: true });
      }

      // ONE-OFF ORDER
      const m = session.metadata || {};
      let orderLinesPretty = "";
      try {
        orderLinesPretty = JSON.parse(m.order_lines || "[]").join("\n");
      } catch {
        orderLinesPretty = String(m.order_lines || "");
      }

      const deliveryWeekday = m.delivery_date ? weekdayFromDMY(m.delivery_date) : "";
      const deliveryDatePretty = deliveryWeekday
        ? `${deliveryWeekday} ${m.delivery_date}`
        : (m.delivery_date || "");

      // Prefer details Stripe collected; fall back to form metadata
      const cd = session.customer_details || ({} as any);
      const isCollectionOrder = m.delivery_method === "collection";

      const customerName = String(m.customer_name || cd.name || "");
      const customerEmail = String(m.customer_email || cd.email || session.customer_email || "");
      const customerPhone = String(m.customer_phone || cd.phone || "");

      // Shipping address (delivery) lives on shipping_details; collection has none
      const shippingAddr =
        (session as any).shipping_details?.address ||
        (session as any).collected_information?.shipping_details?.address ||
        null;
      const stripeAddress = isCollectionOrder
        ? "Collection"
        : safeJoinAddress(shippingAddr) || safeJoinAddress(cd.address);

      const customerAddress = String(m.customer_address || stripeAddress || "");

      const templateParams = {
        brand: "Yoghurt of Youth",
        owner_email: ownerEmail,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        delivery_date: deliveryDatePretty,
        delivery_window: m.delivery_window || "",
        note: m.note || "",
        is_collection: m.delivery_method === "collection" ? "1" : "",
        order_id: m.order_id || "",
        payment_method: "Stripe",
        order_lines: orderLinesPretty,
        bottles: m.bottles || "",
        yoghurt_strain: m.yoghurt_strain || "",
        plain_qty: m.plain_qty || "",
        flav_qty: m.flav_qty || "",
        plain_bundles: m.plain_bundles || "",
        flav_bundles: m.flav_bundles || "",
        plain_remainder: m.plain_remainder || "",
        flav_remainder: m.flav_remainder || "",
        merchandise_total: fmtGbp(m.merchandise_total),
        delivery_fee: fmtGbp(m.delivery_fee),
        total_paid: fmtGbp(m.total_paid),
      };

      // Gift code marking (after payment success)
      const giftCode = String(m.gift_code || "").trim().toUpperCase();
      const discountPercent = Number(m.discount_percent || 0);
      const giftStrQty = Number(m.gift_str_qty || 0);
      const emailKey = customerEmail.trim().toLowerCase();

      await sendMetaPurchaseCAPI({
        orderId: m.order_id || session.id || "",
        email: customerEmail,
        phone: customerPhone,
        value: Number(m.total_paid || 0),
      });

      if ((discountPercent > 0 || giftStrQty > 0) && giftCode && emailKey) {
        const usedKey = `yoy_gift_used:${giftCode}:${emailKey}`;
        await redis.set(usedKey, {
          order_id: m.order_id || "",
          session_id: session.id || "",
          usedAt: Date.now(),
        }, { ex: 60 * 60 * 24 * 30 }); // 30 days expiry
      }

      const ownerTpl = process.env.EMAILJS_TEMPLATE_ID as string;
      const custTpl = process.env.EMAILJS_CUSTOMER_TEMPLATE_ID as string;

      if (ownerTpl) {
        await sendEmailJS(ownerTpl, { ...templateParams, to_email: ownerEmail });
      }
      if (customerEmail && custTpl) {
        await sendEmailJS(custTpl, { ...templateParams, to_email: customerEmail });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err?.message || err);
    return res.status(400).send("Webhook Error");
  }
}

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
