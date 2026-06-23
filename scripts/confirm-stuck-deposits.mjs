import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const REQUIRED = 12;

async function confirmOne(depositId) {
  const deposit = await p.deposit.findUnique({
    where: { id: depositId },
    include: { stake: true },
  });
  if (!deposit || deposit.status === "CONFIRMED") return;

  await p.$transaction(async (tx) => {
    await tx.deposit.update({
      where: { id: deposit.id },
      data: {
        status: "CONFIRMED",
        confirmations: Math.max(deposit.confirmations, REQUIRED),
        confirmedAt: new Date(),
      },
    });

    if (!deposit.stake) {
      await tx.stake.create({
        data: {
          userId: deposit.userId,
          amount: deposit.amount,
          network: deposit.network,
          depositId: deposit.id,
          status: "ACTIVE",
        },
      });
      await tx.user.update({
        where: { id: deposit.userId },
        data: { lockedCapital: { increment: deposit.amount } },
      });
    }
  });

  const user = await p.user.findUnique({
    where: { id: deposit.userId },
    select: { lockedCapital: true },
  });
  if (user) {
    await p.user.update({
      where: { id: deposit.userId },
      data: { payoutCap: user.lockedCapital * 2n },
    });
  }
}

const stuck = await p.deposit.findMany({
  where: { status: "PENDING", confirmations: { gte: REQUIRED } },
});
console.log(`Confirming ${stuck.length} stuck deposit(s)...`);
for (const d of stuck) {
  await confirmOne(d.id);
  console.log(
    `Confirmed ${d.network} ${Number(d.amount) / 1e6} USDT — ${d.txHash.slice(0, 18)}…`,
  );
}

const user = await p.user.findFirst({
  where: { walletAddress: "0xe8344510f226f391d8f43abf425eb00f176f06ef" },
  select: { lockedCapital: true, username: true },
});
console.log(
  "User lockedCapital:",
  Number(user?.lockedCapital ?? 0n) / 1e6,
  "USDT",
);

await p.$disconnect();
