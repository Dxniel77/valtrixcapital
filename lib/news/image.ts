import {
  decodeAvatarBase64,
  isAllowedAvatarMime,
} from "@/lib/user/avatar-image";

export const NEWS_IMAGE_MAX_PX = 1280;
export const NEWS_IMAGE_JPEG_QUALITY = 0.82;
export const NEWS_IMAGE_INPUT_MAX_BYTES = 8 * 1024 * 1024;
export const NEWS_IMAGE_STORED_MAX_BYTES = 500 * 1024;

export const NEWS_TITLE_MAX = 120;
export const NEWS_BODY_MAX = 8_000;

export class NewsImageError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_IMAGE" | "TOO_LARGE",
  ) {
    super(message);
    this.name = "NewsImageError";
  }
}

export function newsImagePublicPath(id: string, version?: number | string): string {
  const base = `/api/news/${id}/image`;
  if (version == null || version === "") return base;
  return `${base}?v=${encodeURIComponent(String(version))}`;
}

export function parseNewsImagePayload(input: {
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
    throw new NewsImageError("Invalid image data", "INVALID_IMAGE");
  }
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!isAllowedAvatarMime(mime)) {
    throw new NewsImageError("Unsupported image type", "INVALID_IMAGE");
  }
  if (bytes.length === 0 || bytes.length > NEWS_IMAGE_STORED_MAX_BYTES) {
    throw new NewsImageError("Image too large after compress", "TOO_LARGE");
  }
  return { bytes, mime };
}
