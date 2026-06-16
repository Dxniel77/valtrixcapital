import type { StakeStatus as DbStakeStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";
import type { StakeDto } from "@/lib/staking/portfolio-types";
import type { StakeStatus } from "@/lib/staking/store";

function mapStakeStatus(status: DbStakeStatus): StakeStatus {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELED") return "FAILED";
  return "ACTIVE";
}

export async function listUserStakes(userId: string): Promise<StakeDto[]> {
  const rows = await prisma.stake.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: { deposit: { select: { txHash: true, confirmedAt: true } } },
  });

  return rows.map((st) => ({
    id: st.id,
    amount: fromMicro(st.amount),
    network: st.network,
    status: mapStakeStatus(st.status),
    txHash: st.deposit?.txHash ?? `0x${st.id.replace(/-/g, "").slice(0, 64).padEnd(64, "0")}`,
    createdAt: st.startedAt.getTime(),
    confirmedAt: st.deposit?.confirmedAt?.getTime() ?? st.startedAt.getTime(),
  }));
}

export async function refreshUserPayoutCap(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedCapital: true },
  });
  if (!user) return;
  await prisma.user.update({
    where: { id: userId },
    data: { payoutCap: user.lockedCapital * 2n },
  });
}
