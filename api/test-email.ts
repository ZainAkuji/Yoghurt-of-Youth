import type { VercelRequest, VercelResponse } from "@vercel/node";

async function sendResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "Missing RESEND_API_KEY" };
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
    return { ok: r.ok, status: r.status, body: text };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ⚠️ CHANGE THIS to your own email address:
  const TEST_RECIPIENT = "zainul.akuji@gmail.com";

  // Toggle ?mode=collection in the URL to test the collection version
  const isCollection = String(req.query.mode || "") === "collection";

  const html = buildOneOffCustomerHtml({
    customerName: "Test Customer",
    customerEmail: TEST_RECIPIENT,
    customerAddress: isCollection ? "" : "42 Preston New Road, Blackburn, BB2 6AB",
    isCollection,
    orderId: "YOY-TEST01",
    deliveryDate: isCollection ? "Thursday 18/06/2026" : "Monday 15/06/2026",
    bottles: isCollection ? "8" : "7",
    paymentMethod: "Stripe",
    totalPaid: isCollection ? "£15.40" : "£17.55",
    orderLines: isCollection ? "BFC × 7\nSTR × 1 (FREE — YOY25)" : "PLN × 7\nFree PLN (7 for 6): 1",
    note: isCollection ? "" : "Please leave with next door if I'm out, thanks!",
  });

  const result = await sendResend(
    TEST_RECIPIENT,
    `[TEST] Your Yoghurt of Youth order confirmation (${isCollection ? "collection" : "delivery"})`,
    html
  );

  return res.status(200).json({ attempted: true, recipient: TEST_RECIPIENT, result });
}
