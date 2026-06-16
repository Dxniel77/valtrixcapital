import { prisma } from "@/lib/db";

let cachedAvailable: boolean | null = null;
let lastCheckMs = 0;
const RECHECK_MS = 30_000;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Returns whether Postgres is reachable (cached briefly). */
export async function isDatabaseAvailable(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  const now = Date.now();
  if (cachedAvailable !== null && now - lastCheckMs < RECHECK_MS) {
    return cachedAvailable;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    cachedAvailable = true;
  } catch {
    cachedAvailable = false;
  }
  lastCheckMs = now;
  return cachedAvailable;
}

export function markDatabaseUnavailable(): void {
  cachedAvailable = false;
  lastCheckMs = Date.now();
}
