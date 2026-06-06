const USERNAME_RE = /^[a-zA-Z0-9._]{3,20}$/;

export type UsernameError = "INVALID" | "TAKEN";

export function normalizeWallet(address: string): string {
  return address.toLowerCase();
}

export function normalizeUsernameKey(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): UsernameError | null {
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) return "INVALID";
  return null;
}
