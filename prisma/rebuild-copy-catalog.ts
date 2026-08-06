import { PrismaClient } from "@prisma/client";
import {
  refreshCopyTraderHistory,
  seedCopyTraders,
} from "./seed-copy-traders";

/**
 * Rebuilds the copy-trading catalog to the current generated set (create new,
 * refresh profiles of existing, hide retired). Safe to run repeatedly: it never
 * touches investments, ledger entries, withdrawals or performance events, so no
 * investor balance can change.
 */
const prisma = new PrismaClient();

async function main() {
  console.log("Rebuilding copy-trading catalog…");
  await seedCopyTraders(prisma);
  // Also apply the current generated outcome/risk mix to traders that already
  // existed before this rebuild. This changes display history only.
  await refreshCopyTraderHistory(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
