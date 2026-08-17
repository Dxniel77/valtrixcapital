import type { Prisma } from "@prisma/client";
import {
  COPY_NETWORK_LEVELS,
  splitPerformanceFeeNetwork,
} from "@/lib/copy-trading/performance-fee-network";

async function resolveUplineIds(
  tx: Prisma.TransactionClient,
  startUserId: string,
  maxLevels: number,
): Promise<string[]> {
  const chain: string[] = [];
  let currentId: string | null = startUserId;
  for (let hop = 0; hop < maxLevels && currentId; hop += 1) {
    const row: { referrerId: string | null } | null =
      await tx.user.findUnique({
        where: { id: currentId },
        select: { referrerId: true },
      });
    const referrerId: string | null = row?.referrerId ?? null;
    if (!referrerId) break;
    chain.push(referrerId);
    currentId = referrerId;
  }
  return chain;
}

/** Pays L1–L6 from one copier's Performance Fee. Idempotent per ledger row. */
export async function distributePerformanceFeeNetwork(
  tx: Prisma.TransactionClient,
  input: {
    sourceUserId: string;
    feeLedgerId: string;
    feeMicro: bigint;
    ratesBps: number[];
  },
): Promise<bigint> {
  if (input.feeMicro <= 0n) return 0n;

  const uplines = await resolveUplineIds(
    tx,
    input.sourceUserId,
    COPY_NETWORK_LEVELS,
  );
  const split = splitPerformanceFeeNetwork(
    input.feeMicro,
    input.ratesBps,
    uplines.length,
  );
  let paid = 0n;

  for (const payout of split.payouts) {
    const beneficiaryId = uplines[payout.level - 1];
    if (!beneficiaryId) continue;

    const existing = await tx.commission.findFirst({
      where: {
        beneficiaryId,
        sourceCopyLedgerId: input.feeLedgerId,
        level: payout.level,
      },
      select: { id: true },
    });
    if (existing) continue;

    try {
      await tx.commission.create({
        data: {
          beneficiaryId,
          sourceUserId: input.sourceUserId,
          level: payout.level,
          rateBps: payout.rateBps,
          amount: payout.amount,
          sourceCopyLedgerId: input.feeLedgerId,
        },
      });
      await tx.user.update({
        where: { id: beneficiaryId },
        data: {
          earningsBalance: { increment: payout.amount },
          totalEarned: { increment: payout.amount },
        },
      });
      paid += payout.amount;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  return paid;
}
