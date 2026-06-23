import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const deps = await p.deposit.findMany({
  orderBy: { detectedAt: "desc" },
  take: 15,
  include: {
    user: {
      select: { walletAddress: true, lockedCapital: true, username: true },
    },
  },
});
for (const d of deps) {
  console.log({
    tx: d.txHash,
    network: d.network,
    amount: Number(d.amount) / 1e6,
    status: d.status,
    confirmations: d.confirmations,
    wallet: d.user.walletAddress,
    lockedCapital: Number(d.user.lockedCapital) / 1e6,
    username: d.user.username,
  });
}
await p.$disconnect();
