import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";

function normalizeSiteUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}

async function paypalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET_KEY}`
  ).toString("base64");

  const tokenResp = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(data?.error_description || "PayPal token failed");
  return data.access_token as string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { cart, totals, customer, fulfilment_method, delivery_date, delivery_window, note, lines, gift_code, gift_str_qty } = req.body;

  const giftCode = String(gift_code || "").trim().toUpperCase();
  const giftStrQty = Number(gift_str_qty || 0);
  
  if (giftStrQty > 0) {
    const emailKey = String(customer?.email || "").trim().toLowerCase();
    const usedKey = `yoy_gift_used:${giftCode}:${emailKey}`;
  
    const alreadyUsed = await kv.get(usedKey);
    if (alreadyUsed) {
      return res.status(400).json({ error: "Gift code already used for this email." });
    }
  }

  const access_token = await paypalAccessToken();

  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_DOMAIN;
  const siteUrl = normalizeSiteUrl(rawSiteUrl || "");
  if (!siteUrl) throw new Error("Missing NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_DOMAIN");

  const orderRef = `YOY-${Date.now().toString().slice(-6)}`;

  const custom = {
    await kv.set(`paypal_order_${orderRef}`, custom, { ex: 60 * 60 * 24 }); // 24h

    order_id: orderRef,

    customer_name: customer.name,
    customer_email: customer.email,
    customer_phone: customer.phone,
    customer_address: customer.address,

    fulfilment_method: String(fulfilment_method || "delivery"),
    fulfilment_label: fulfilment_method === "collection" ? "Collection" : "Delivery",
    delivery_date,
    delivery_window,
    note: note || "",

    // same fields you send via EmailJS now:
    order_lines: (lines || []).join("\n"),
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

    gift_code: giftCode,
    gift_str_qty: String(giftStrQty || 0),

    yoghurt_strain: String(totals.deliveryBrand || ""),
    payment_provider: "paypal",
  };

  try {
    const createResp = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: orderRef,
            custom_id: orderRef,
            amount: {
              currency_code: "GBP",
              value: Number(totals.total).toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "Yoghurt of Youth",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          return_url: `${siteUrl}/?pay=success&provider=paypal`,
          cancel_url: `${siteUrl}/?pay=cancel&provider=paypal`,
        },
      }),
    });

    const text = await createResp.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    
    if (!createResp.ok) {
      console.error("PayPal create-order status:", createResp.status);
      console.error("PayPal create-order body:", data || text);
      const details = data?.details?.map((d:any)=> `${d.issue}: ${d.description}`).join(" | ");
      throw new Error(details || data?.message || "PayPal create order failed");
    }

    const approvalUrl = data.links?.find((l: any) => l.rel === "approve")?.href;
    return res.status(200).json({ approvalUrl, id: data.id, order_id: orderRef });
  } catch (e: any) {
    console.error("PayPal error:", e);
    return res.status(500).json({ error: e.message });
  }
}
