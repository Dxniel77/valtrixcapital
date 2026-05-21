import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function makeCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function main() {
  console.log("Seeding Valtrix Capital database…");

  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const admin = await prisma.user.upsert({
    where: { walletAddress: "0xadmin0000000000000000000000000000000000a" },
    update: {},
    create: {
      walletAddress: "0xadmin0000000000000000000000000000000000a",
      username: "Admin",
      role: "ADMIN",
      referralCode: makeCode(),
    },
  });

  const demoWallets = [
    "0xdemo0000000000000000000000000000000000001",
    "0xdemo0000000000000000000000000000000000002",
    "0xdemo0000000000000000000000000000000000003",
  ];
  for (const w of demoWallets) {
    await prisma.user.upsert({
      where: { walletAddress: w },
      update: {},
      create: {
        walletAddress: w,
        username: `Demo ${w.slice(-3)}`,
        referralCode: makeCode(),
        referrerId: admin.id,
      },
    });
  }

  console.log("Done seeding.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
