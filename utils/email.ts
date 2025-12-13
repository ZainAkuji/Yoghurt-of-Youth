import emailjs from "@emailjs/nodejs";

export async function sendOrderEmail(order: any) {
  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID!,
    process.env.EMAILJS_TEMPLATE_ID!,
    order,
    { publicKey: process.env.EMAILJS_PUBLIC_KEY! }
  );
}
