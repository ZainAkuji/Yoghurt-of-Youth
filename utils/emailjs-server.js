type EmailPayload = Record<string, any>;

export async function sendEmailJS(templateId: string, templateParams: EmailPayload) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !publicKey || !privateKey) {
    throw new Error("Missing EmailJS env vars (SERVICE_ID / PUBLIC_KEY / PRIVATE_KEY).");
  }

  const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      publicKey,          // ✅ correct for server-side
      privateKey,         // ✅ correct for server-side
      template_params: templateParams,
    }),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`EmailJS failed: ${r.status} ${text}`);
  }
}
