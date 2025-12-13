type EmailPayload = Record<string, any>;

export async function sendEmailJS(templateId: string, templateParams: EmailPayload) {
  const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY, // server-side
      template_params: templateParams,
    }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`EmailJS failed: ${r.status} ${text}`);
  }
}
