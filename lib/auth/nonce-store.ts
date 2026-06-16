import { generateNonce } from "siwe";
import { prisma } from "@/lib/db";
import { isDatabaseAvailable } from "@/lib/db/available";

const NONCE_TTL_MS = 5 * 60 * 1000;

export interface NonceRecord {
  nonce: string;
  expiresAt: Date;
}

const memoryNonces = new Map<string, NonceRecord>();

export async function createStoredNonce(address?: string): Promise<NonceRecord> {
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

  if (await isDatabaseAvailable()) {
    try {
      await prisma.authNonce.create({
        data: {
          nonce,
          address: address?.toLowerCase() ?? null,
          expiresAt,
        },
      });
      return { nonce, expiresAt };
    } catch {
      // fall through to memory store
    }
  }

  memoryNonces.set(nonce, { nonce, expiresAt });
  cleanupExpiredMemory();
  return { nonce, expiresAt };
}

export async function consumeStoredNonce(nonce: string): Promise<boolean> {
  if (await isDatabaseAvailable()) {
    try {
      const row = await prisma.authNonce.findUnique({ where: { nonce } });
      if (!row) return false;
      if (row.expiresAt.getTime() < Date.now()) {
        await prisma.authNonce.delete({ where: { id: row.id } }).catch(() => undefined);
        return false;
      }
      await prisma.authNonce.delete({ where: { id: row.id } });
      return true;
    } catch {
      // fall through
    }
  }

  const record = memoryNonces.get(nonce);
  if (!record) return false;
  if (record.expiresAt.getTime() < Date.now()) {
    memoryNonces.delete(nonce);
    return false;
  }
  memoryNonces.delete(nonce);
  return true;
}

function cleanupExpiredMemory() {
  const now = Date.now();
  for (const [key, rec] of memoryNonces.entries()) {
    if (rec.expiresAt.getTime() < now) memoryNonces.delete(key);
  }
}
