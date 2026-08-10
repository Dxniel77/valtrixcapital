/**
 * Browser-side avatar compress: resize to max edge, export JPEG.
 * Keeps Neon payloads small (~20–80KB typical).
 */
import {
  AVATAR_INPUT_MAX_BYTES,
  AVATAR_JPEG_QUALITY,
  AVATAR_MAX_PX,
  isAllowedAvatarMime,
} from "@/lib/user/avatar-image";

export async function compressAvatarFile(file: File): Promise<{
  dataUrl: string;
  mime: string;
}> {
  if (!isAllowedAvatarMime(file.type)) {
    throw new Error("INVALID_TYPE");
  }
  if (file.size > AVATAR_INPUT_MAX_BYTES) {
    throw new Error("TOO_LARGE");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("CANVAS");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY);
  return { dataUrl, mime: "image/jpeg" };
}
