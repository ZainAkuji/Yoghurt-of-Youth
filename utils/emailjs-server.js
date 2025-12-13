import emailjs from "@emailjs/nodejs";

export async function sendEmail(data) {
  return emailjs.send(
    process.env.EMAILJS_SERVICE_ID!,
    process.env.EMAILJS_TEMPLATE_ID!,
    data,
    { publicKey: process.env.EMAILJS_PUBLIC_KEY! }
  );
}
