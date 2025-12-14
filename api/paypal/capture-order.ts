import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { orderId } = req.body;

  const r = await fetch(
    `https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64"),
      },
    }
  );

  const data = await r.json();

  // Email from server
  if (data.status === "COMPLETED") {
    await sendEmail({
      name: data.payer.name.given_name,
      email: data.payer.email_address,
      orderId,
      total: data.purchase_units[0].amount.value,
      paymentMethod: "PayPal",
    });
  }

  res.status(200).json(data);
}

