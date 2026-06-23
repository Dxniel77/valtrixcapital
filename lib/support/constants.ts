export const SUPPORT_EMAIL = "soporte@capitalvaltrix.com";

export const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_SUPPORT_ATTACHMENTS_PER_MESSAGE = 5;

export const SUPPORT_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;
