import type { NextApiRequest, NextApiResponse } from "next";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { cart, totals, customer, delivery_date, delivery_window, note, lines } = req.body;

  const access_token = await paypalAccessToken();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_DOMAIN;
  if (!siteUrl) return res.status(500).json({ error: "Missing NEXT_PUBLIC_SITE_URL" });

  const orderRef = `YOY-${Date.now().toString().slice(-6)}`;

  // IMPORTANT: Put all your “EmailJS template fields” into custom_id (string)
  // We’ll read this later from capture + webhook.
  const custom = {
    order_id: orderRef,

    customer_name: customer.name,
    customer_email: customer.email,
    customer_phone: customer.phone,
    customer_address: customer.address,

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
            custom_id: JSON.stringify(custom),
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
          cancel_url: `${siteUrl}/?pay=cancelled&provider=paypal`,
        },
      }),
    });

    const data = await createResp.json();
    if (!createResp.ok) throw new Error(data?.message || "PayPal create order failed");

    const approvalUrl = data.links?.find((l: any) => l.rel === "approve")?.href;
    return res.status(200).json({ approvalUrl, id: data.id });
  } catch (e: any) {
    console.error("PayPal error:", e);
    return res.status(500).json({ error: e.message });
  }
}
