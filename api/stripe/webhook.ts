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

async function sendResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Missing RESEND_API_KEY");
    return;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Yoghurt of Youth <orders@yoghurtofyouth.co.uk>",
        to,
        subject,
        html,
      }),
    });
    const text = await r.text();
    console.log("Resend response:", r.status, text);
    if (!r.ok) throw new Error(`Resend failed: ${r.status} ${text}`);
  } catch (err) {
    console.error("Resend send failed:", err);
    // Don't throw — let the webhook still return 200 to Stripe
  }
}

function buildOneOffCustomerHtml(p: {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  isCollection: boolean;
  orderId: string;
  deliveryDate: string;
  bottles: string;
  paymentMethod: string;
  totalPaid: string;
  orderLines: string;
  note: string;
}) {
  const introHtml = p.isCollection
    ? `<p style="margin:0 0 14px;">Thank you for your order with <strong>Yoghurt of Youth</strong>. Your payment has been successfully received. Your yoghurts will be fermented on the day before collection for freshness.</p>`
    : `<p style="margin:0 0 14px;">Thank you for your order with <strong>Yoghurt of Youth</strong>. Your payment has been successfully received. Your yoghurts will be fermented on the day before dispatch for freshness.</p>
       <p style="margin:0 0 14px;">Your order will be sent via DPD Next Day delivery and should arrive the next day. The package is insulated and chilled to maintain the correct temperature for the products during transit.</p>
       <p style="margin:0 0 14px;">Please ensure someone is available to receive the parcel, or select a safe place if preferred.</p>`;

  const dateLabel = p.isCollection ? "Collection date" : "Dispatch date";

  const windowRow = p.isCollection
    ? `<tr><td style="padding:6px 0;color:#555;"><strong>Collection window:</strong></td><td style="padding:6px 0;">12:00pm–9:00pm</td></tr>`
    : "";

  const addressRow = p.isCollection
    ? `<tr><td style="padding:6px 0;color:#555;"><strong>Collection address:</strong></td>
         <td style="padding:6px 0;"><a href="https://www.google.com/maps/search/?api=1&query=11+Billinge+Avenue,+Blackburn,+Lancashire,+BB2+6SD" style="color:#0ea5e9;font-weight:600;text-decoration:none;" target="_blank" rel="noreferrer">11 Billinge Avenue, Blackburn, Lancashire, BB2 6SD</a></td></tr>`
    : `<tr><td style="padding:6px 0;color:#555;"><strong>Delivery address:</strong></td>
         <td style="padding:6px 0;">${p.customerAddress}</td></tr>`;

  const noteHtml = p.note
    ? `<p style="margin:12px 0 0;"><strong>Order note:</strong><br>${p.note}</p>`
    : "";

  const closingHtml = p.isCollection
    ? `<p style="margin:18px 0 0;">You will receive a text when your order is ready for collection. If possible, please call, text or email us when you are heading out to collect your order. If you need to make any changes, please reply to this email.</p>`
    : `<p style="margin:18px 0 0;">You will receive a text when your order is dispatched. If you need to make any changes, please reply to this email.</p>`;

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#333;padding:16px;background-color:#f5f5f5;">
  <div style="max-width:600px;margin:auto;background-color:#fff;border-top:6px solid #1e293b;">
    <div style="padding:16px;background-color:#f9fafb;border-bottom:1px solid #e2e8f0;">
      <img src="https://yoghurtofyouth.co.uk/logo.png" alt="Yoghurt of Youth" height="32" style="vertical-align:middle;">
      <span style="font-size:18px;font-weight:700;margin-left:8px;vertical-align:middle;">Yoghurt of Youth</span>
    </div>
    <div style="padding:20px;">
      <p style="margin:0 0 12px;">Dear ${p.customerName},</p>
      ${introHtml}
      <p style="margin:0 0 18px;">Below are the full details of your order.</p>
      <p style="margin:0 0 18px;">Please leave us a review on Google and follow us on Instagram. Links are down below.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;margin-bottom:16px;">
        <strong>Order reference:</strong><br>
        <span style="font-size:16px;font-weight:700;letter-spacing:0.3px;">${p.orderId}</span>
      </div>
      <table role="presentation" style="border-collapse:collapse;width:100%;">
        <tbody>
          <tr><td style="padding:6px 0;width:45%;color:#555;"><strong>${dateLabel}:</strong></td><td style="padding:6px 0;">${p.deliveryDate}</td></tr>
          ${windowRow}
          ${addressRow}
          <tr><td style="padding:6px 0;color:#555;"><strong>Total bottles:</strong></td><td style="padding:6px 0;">${p.bottles}</td></tr>
          <tr><td style="padding:6px 0;color:#555;"><strong>Payment method:</strong></td><td style="padding:6px 0;">${p.paymentMethod}</td></tr>
          <tr><td style="padding:10px 0;border-top:1px solid #e2e8f0;"><strong>Total paid:</strong></td><td style="padding:10px 0;border-top:1px solid #e2e8f0;"><strong>${p.totalPaid}</strong></td></tr>
        </tbody>
      </table>
      <h4 style="margin:20px 0 8px;font-size:16px;">Your items</h4>
      <pre style="background:#f8fafc;padding:10px;border:1px solid #e2e8f0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${p.orderLines}</pre>
      ${noteHtml}
      ${closingHtml}
      <p style="margin:16px 0 0;"><strong>– The Yoghurt of Youth Team</strong></p>
    </div>
    <div style="border-top:1px solid #e2e8f0;margin:0 20px;"></div>
    <div style="padding:20px;text-align:center;background-color:#f9fafb;">
      <p style="margin:0 0 12px;font-weight:600;">Enjoyed your experience?</p>
      <p style="margin:0 0 16px;color:#555;">Your feedback helps us grow and continue producing exceptional yoghurt.</p>
      <a href="https://g.page/r/CWkxtud6iKYlEAE/review" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">⭐ Leave a Google Review</a>
      <p style="margin:14px 0 0;"><a href="https://www.instagram.com/yoghurtofyouth" style="color:#0ea5e9;font-weight:600;text-decoration:none;">📸 Follow us on Instagram</a></p>
    </div>
    <div style="padding:12px;text-align:center;font-size:12px;color:#777;border-top:1px solid #e2e8f0;">
      This confirmation was sent to ${p.customerEmail}<br>
      Yoghurt of Youth · Blackburn, Lancashire
    </div>
  </div>
</div>`;
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

        const cd = session.customer_details || ({} as any);
        const subShipName =
          (session as any).shipping_details?.name ||
          (session as any).collected_information?.shipping_details?.name ||
          "";
        const customer_name = String((sm as any).name || cd.name || subShipName || "");
        const customer_email = String(cd.email || session.customer_email || "");
        const customer_phone = String((sm as any).phone || cd.phone || "");
        const subShippingAddr =
          (session as any).shipping_details?.address ||
          (session as any).collected_information?.shipping_details?.address ||
          null;
        const customer_address =
          String((sm as any).address || "") ||
          safeJoinAddress(subShippingAddr) ||
          safeJoinAddress(cd.address) ||
          "";

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

        const ownerTpl = process.env.EMAILJS_TEMPLATE_ID as string;

        // Owner email still via EmailJS for now
        if (ownerTpl) {
          await sendEmailJS(ownerTpl, { ...templateParams, to_email: ownerEmail });
        }
  
        // Customer email now via Resend
        if (customerEmail) {
          const customerHtml = buildOneOffCustomerHtml({
            customerName,
            customerEmail,
            customerAddress,
            isCollection: isCollectionOrder,
            orderId: m.order_id || "",
            deliveryDate: deliveryDatePretty,
            bottles: String(m.bottles || ""),
            paymentMethod: "Stripe",
            totalPaid: fmtGbp(m.total_paid),
            orderLines: orderLinesPretty,
            note: String(m.note || ""),
          });
          await sendResend(
            customerEmail,
            "Your Yoghurt of Youth order confirmation",
            customerHtml
          );
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

      const shipName =
        (session as any).shipping_details?.name ||
        (session as any).collected_information?.shipping_details?.name ||
        "";
      const customerName = String(m.customer_name || cd.name || shipName || "");
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
