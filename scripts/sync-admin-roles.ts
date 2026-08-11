/**
 * Sync User.role ADMIN to match ADMIN_WALLETS (or explicit CLI list).
 * Usage:
 *   node scripts/run-with-env.mjs npx tsx scripts/sync-admin-roles.ts
 *   node scripts/run-with-env.mjs npx tsx scripts/sync-admin-roles.ts 0xabc...,0xdef...
 */
import { PrismaClient } from "@prisma/client";

function dbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  // Prefer a single connection for one-off admin scripts (avoid pooler exhaustion).
  const u = new URL(raw);
  u.searchParams.set("connection_limit", "1");
  u.searchParams.set("pool_timeout", "30");
  u.searchParams.set("connect_timeout", "30");
  return u.toString();
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl() } },
});

function normalize(address: string): string {
  return address.trim().toLowerCase();
}

function parseWallets(raw: string): string[] {
  const wallets = raw
    .split(",")
    .map(normalize)
    .filter((w) => /^0x[a-f0-9]{40}$/.test(w));
  return [...new Set(wallets)];
}

async function main() {
  const fromArg = process.argv[2]?.trim();
  const wanted = parseWallets(
    fromArg || process.env.ADMIN_WALLETS || "",
  );

  if (wanted.length === 0) {
    console.error("No wallets provided. Pass a comma list or set ADMIN_WALLETS.");
    process.exit(1);
  }

  console.log(`Target ADMIN wallets (${wanted.length}):`);
  for (const w of wanted) console.log(`  ${w}`);

  const before = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { walletAddress: true, role: true },
    orderBy: { walletAddress: "asc" },
  });
  console.log("\nCurrent ADMIN in DB:");
  for (const u of before) console.log(`  ${u.walletAddress}`);
  if (before.length === 0) console.log("  (none)");

  const missing: string[] = [];
  for (const wallet of wanted) {
    const updated = await prisma.user.updateMany({
      where: { walletAddress: wallet },
      data: { role: "ADMIN" },
    });
    if (updated.count === 0) {
      // try case-insensitive match (legacy mixed case)
      const row = await prisma.user.findFirst({
        where: { walletAddress: { equals: wallet, mode: "insensitive" } },
        select: { id: true, walletAddress: true },
      });
      if (row) {
        await prisma.user.update({
          where: { id: row.id },
          data: { role: "ADMIN" },
        });
        console.log(`Promoted ${row.walletAddress} → ADMIN`);
      } else {
        missing.push(wallet);
        console.log(`NOT FOUND (must sign in once first): ${wallet}`);
      }
    } else {
      console.log(`Promoted ${wallet} → ADMIN`);
    }
  }

  const demote = await prisma.user.updateMany({
    where: {
      role: "ADMIN",
      NOT: {
        OR: wanted.map((wallet) => ({
          walletAddress: { equals: wallet, mode: "insensitive" },
        })),
      },
    },
    data: { role: "USER" },
  });
  console.log(`\nDemoted other ADMIN users: ${demote.count}`);

  const after = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { walletAddress: true },
    orderBy: { walletAddress: "asc" },
  });
  console.log("\nADMIN in DB now:");
  for (const u of after) console.log(`  ${u.walletAddress}`);

  if (missing.length) {
    console.log(
      "\nNote: missing wallets have no User row yet. Connect that wallet once on the site, then re-run this script.",
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
