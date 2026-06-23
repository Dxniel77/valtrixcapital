export function buildMailtoUrl(
  email: string,
  subject: string,
  body = "",
): string {
  const params = new URLSearchParams();
  if (subject.trim()) params.set("subject", subject.trim());
  if (body.trim()) params.set("body", body.trim());
  const query = params.toString();
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}

export function buildGmailComposeUrl(
  email: string,
  subject: string,
  body = "",
): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
    su: subject.trim(),
    body: body.trim(),
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** Opens the system mail client without breaking native mailto handling. */
export function openMailtoUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
