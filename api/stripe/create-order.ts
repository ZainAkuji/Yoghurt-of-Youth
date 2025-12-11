import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, orderId } = req.body;

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    const orderRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: `Yoghurt of Youth order #${orderId}`,
            amount: {
              currency_code: "GBP",
              value: amount.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: `${process.env.NEXT_PUBLIC_DOMAIN}/paypal-success?orderId=${orderId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}/cancel`,
        },
      }),
    });

    const orderJson = await orderRes.json();

    return res.status(200).json(orderJson);
  } catch (err) {
    console.error("PayPal error:", err);
    return res.status(500).json({ error: "PayPal error" });
  }
}
