import { SiweMessage, generateNonce } from "siwe";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface NonceRecord {
  nonce: string;
  expiresAt: Date;
}

const memoryNonces = new Map<string, NonceRecord>();

export function createNonce(): NonceRecord {
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
  memoryNonces.set(nonce, { nonce, expiresAt });
  cleanupExpired();
  return { nonce, expiresAt };
}

export function consumeNonce(nonce: string): boolean {
  const record = memoryNonces.get(nonce);
  if (!record) return false;
  if (record.expiresAt.getTime() < Date.now()) {
    memoryNonces.delete(nonce);
    return false;
  }
  memoryNonces.delete(nonce);
  return true;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, rec] of memoryNonces.entries()) {
    if (rec.expiresAt.getTime() < now) memoryNonces.delete(key);
  }
}

export async function verifySiwe({
  message,
  signature,
  expectedNonce,
}: {
  message: string;
  signature: string;
  expectedNonce: string;
}): Promise<{ address: string; chainId: number } | null> {
  try {
    const siwe = new SiweMessage(message);
    const result = await siwe.verify({ signature, nonce: expectedNonce });
    if (!result.success) return null;
    return {
      address: siwe.address.toLowerCase(),
      chainId: siwe.chainId,
    };
  } catch {
    return null;
  }
}

export function buildSiweMessage({
  address,
  chainId,
  nonce,
  domain,
  uri,
  statement,
}: {
  address: string;
  chainId: number;
  nonce: string;
  domain: string;
  uri: string;
  statement?: string;
}): string {
  const msg = new SiweMessage({
    domain,
    address,
    statement:
      statement ??
      "Sign in to Valtrix Capital. This signature proves wallet ownership and never authorises a transaction.",
    uri,
    version: "1",
    chainId,
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
  });
  return msg.prepareMessage();
}
