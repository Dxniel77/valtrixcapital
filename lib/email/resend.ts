export async function sendWithResend(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const from =
    process.env.RESEND_FROM?.trim() || "Valtrix Capital <noreply@valtrix.capital>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    }),
  });

  if (!res.ok) {
    console.error("[email] Resend delivery failed", res.status, await res.text());
    return false;
  }

  return true;
}
