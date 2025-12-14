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
  const token = String(req.query.token || "");
  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    const access_token = await paypalAccessToken();

    // CAPTURE
    const capResp = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${token}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await capResp.json();
    if (!capResp.ok) throw new Error(data?.message || "PayPal capture failed");

    const paid = data?.status === "COMPLETED";
    const customRaw = data?.purchase_units?.[0]?.custom_id || "";
    let custom: any = {};
    try { custom = JSON.parse(customRaw); } catch {}

    return res.status(200).json({
      paid,
      order_id: custom.orderId || custom.order_id || "",
      paypal_order_id: token,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
