import {
  AVATAR_STORED_MAX_BYTES,
  avatarPublicPath,
  decodeAvatarBase64,
  isAllowedAvatarMime,
} from "@/lib/user/avatar-image";

/** Normalize legacy external http(s) avatar URLs. Empty → null. */
export function normalizeAvatarUrl(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/api/avatars/")) return trimmed.slice(0, 500);
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
    readonly code:
      | "INVALID_URL"
      | "INVALID_IMAGE"
      | "TOO_LARGE"
      | "NOT_IB"
      | "NOT_FOUND",
  ) {
    super(message);
    this.name = "AvatarUrlError";
  }
}

export function parseAvatarUploadPayload(input: {
  dataBase64: string;
  mime?: string;
}): { bytes: Buffer; mime: string } {
  let bytes: Buffer;
  let mime: string;
  try {
    const decoded = decodeAvatarBase64(input.dataBase64);
    bytes = decoded.bytes;
    mime = (input.mime || decoded.mime || "image/jpeg").toLowerCase();
  } catch {
    throw new AvatarUrlError("Invalid image data", "INVALID_IMAGE");
  }
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!isAllowedAvatarMime(mime)) {
    throw new AvatarUrlError("Unsupported image type", "INVALID_IMAGE");
  }
  if (bytes.length === 0 || bytes.length > AVATAR_STORED_MAX_BYTES) {
    throw new AvatarUrlError("Image too large after compress", "TOO_LARGE");
  }
  return { bytes, mime };
}
