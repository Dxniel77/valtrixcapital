/** Normalize / validate an IB avatar image URL. Empty → null. */
export function normalizeAvatarUrl(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) {
    throw new AvatarUrlError("URL too long", "INVALID_URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AvatarUrlError("Invalid URL", "INVALID_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AvatarUrlError("URL must be http(s)", "INVALID_URL");
  }
  return trimmed;
}

export class AvatarUrlError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_URL" | "NOT_IB" | "NOT_FOUND",
  ) {
    super(message);
    this.name = "AvatarUrlError";
  }
}
