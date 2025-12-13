import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const {
    cart,
    totals,
    customer,
    delivery_date,
    delivery_window,
    note,
  } = req.body;

  const orderId = `YOY-${Date.now().toString().slice(-6)}`;

  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET_KEY}`
    ).toString("base64");

    const tokenResp = await fetch(
      "https://api-m.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      }
    );

    const { access_token } = await tokenResp.json();

    const items = Object.entries(cart).map(([id, qty]) => ({
      name: id,
      quantity: qty.toString(),
      unit_amount: { currency_code: "GBP", value: "0.00" },
    }));

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
            reference_id: orderId,
            custom_id: JSON.stringify({
              orderId,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              delivery_date,
              delivery_window,
              qtyTotal: totals.qtyTotal,
              plainQty: totals.plainQty,
              flavQty: totals.flavQty,
              totalText: `£${totals.total.toFixed(2)}`,
              note,
              lines: items.map((i) => i.name),
            }),
            amount: {
              currency_code: "GBP",
              value: totals.total.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "Yoghurt of Youth",
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          return_url: `${process.env.NEXT_PUBLIC_DOMAIN}/checkout/success?paypal=true&order_id=${orderId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}?cancelled=true`,
        },
      }),
    });

    const data = await createResp.json();

    const approvalUrl = data.links.find((l: any) => l.rel === "approve")?.href;

    return res.status(200).json({ approvalUrl });
  } catch (e: any) {
    console.error("PayPal error:", e);
    return res.status(500).json({ error: e.message });
  }
}
