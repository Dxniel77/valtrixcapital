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

  const adminWallets = (process.env.ADMIN_WALLETS ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^0x[a-f0-9]{40}$/.test(w));

  for (const walletAddress of adminWallets) {
    await prisma.user.upsert({
      where: { walletAddress },
      update: { role: "ADMIN" },
      create: {
        walletAddress,
        username: "Admin",
        role: "ADMIN",
        referralCode: makeCode(),
      },
    });
  }

  if (adminWallets.length === 0) {
    console.warn(
      "No ADMIN_WALLETS set — only AppConfig was seeded. Add manager wallets to ADMIN_WALLETS before running db:seed.",
    );
  }

  console.log("Done seeding.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
