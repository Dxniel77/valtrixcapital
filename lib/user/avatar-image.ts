/** Max edge length for IB avatars (px). */
export const AVATAR_MAX_PX = 256;
/** Soft target quality for JPEG compression (0–1). */
export const AVATAR_JPEG_QUALITY = 0.82;
/** Reject uploads larger than this before compress (bytes). */
export const AVATAR_INPUT_MAX_BYTES = 5 * 1024 * 1024;
/** Reject stored payloads larger than this after compress (bytes). */
export const AVATAR_STORED_MAX_BYTES = 120 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isAllowedAvatarMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function avatarPublicPath(userId: string, version?: number | string): string {
  const base = `/api/avatars/${userId}`;
  if (version == null || version === "") return base;
  return `${base}?v=${encodeURIComponent(String(version))}`;
}

/** Decode a data-URL or raw base64 payload into bytes. */
export function decodeAvatarBase64(input: string): {
  bytes: Buffer;
  mime: string;
} {
  const trimmed = input.trim();
  const dataUrl = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (dataUrl) {
    const mime = dataUrl[1].toLowerCase();
    const bytes = Buffer.from(dataUrl[2], "base64");
    return { bytes, mime };
  }
  return {
    bytes: Buffer.from(trimmed, "base64"),
    mime: "image/jpeg",
  };
}
