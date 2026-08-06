import { PrismaClient } from "@prisma/client";
import { refreshCopyTraderHistory } from "./seed-copy-traders";

const prisma = new PrismaClient();

async function main() {
  console.log("Rebuilding copy trader track records…");
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
