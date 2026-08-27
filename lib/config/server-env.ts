/**
 * Read a server env var at runtime.
 *
 * Do not use `process.env.COPY_PAYOUT_PRIVATE_KEY` as a static identifier.
 * Next.js can replace that with an empty string at build time, so a Vercel
 * secret added later (or marked sensitive) never reaches the payout signer.
 */
export function readServerSecret(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().replace(/^["']|["']$/g, "");
    if (trimmed) return trimmed;
  }
  return "";
}
