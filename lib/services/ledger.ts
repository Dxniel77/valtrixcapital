import type { LedgerCategory } from "@/lib/ledger";
import { prisma } from "@/lib/db";
import { fromMicro } from "@/lib/utils";

export interface LedgerEntryDto {
  id: string;
  category: LedgerCategory;
  timestamp: number;
  amount: number;
  network: "BSC" | "POLYGON" | null;
  txHash: string | null;
  status: string | null;
  pair?: string;
  direction?: "UP" | "DOWN";
  level?: number;
  sourceWallet?: string;
  fee?: number;
  note?: string;
}

export async function buildUserLedger(userId: string): Promise<LedgerEntryDto[]> {
  const [stakes, deposits, withdrawals, yields, commissions, trades, adjustments] =
    await Promise.all([
      prisma.stake.findMany({
        where: { userId },
        include: { deposit: true },
        orderBy: { startedAt: "desc" },
        take: 500,
      }),
      prisma.deposit.findMany({
        where: { userId },
        orderBy: { detectedAt: "desc" },
        take: 500,
      }),
      prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { requestedAt: "desc" },
        take: 500,
      }),
      prisma.dailyYieldRecord.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.commission.findMany({
        where: { beneficiaryId: userId },
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
          sourceUser: { select: { walletAddress: true } },
        },
      }),
      prisma.trade.findMany({
        where: { userId },
        orderBy: { openedAt: "desc" },
        take: 500,
      }),
      prisma.adminAction.findMany({
        where: { targetUserId: userId, action: "ADJUST_BALANCE" },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

  const entries: LedgerEntryDto[] = [];

  for (const st of stakes) {
    const dep = st.deposit;
    entries.push({
      id: `dep_${st.id}`,
      category: "DEPOSIT",
      timestamp: (dep?.confirmedAt ?? dep?.detectedAt ?? st.startedAt).getTime(),
      amount: fromMicro(st.amount),
      network: st.network,
      txHash: dep?.txHash ?? null,
      status: st.status,
    });
  }

  for (const dep of deposits) {
    if (stakes.some((s) => s.depositId === dep.id)) continue;
    entries.push({
      id: `dep_pending_${dep.id}`,
      category: "DEPOSIT",
      timestamp: dep.detectedAt.getTime(),
      amount: fromMicro(dep.amount),
      network: dep.network,
      txHash: dep.txHash,
      status: dep.status === "CONFIRMED" ? "ACTIVE" : "PENDING",
    });
  }

  for (const w of withdrawals) {
    entries.push({
      id: `wd_${w.id}`,
      category: "WITHDRAWAL",
      timestamp: w.requestedAt.getTime(),
      amount: -fromMicro(w.amount),
      network: w.network,
      txHash: w.txHash,
      status: w.status,
      fee: fromMicro(w.fee),
    });
  }

  for (const y of yields) {
    entries.push({
      id: `yld_${y.id}`,
      category: "YIELD",
      timestamp: y.createdAt.getTime(),
      amount: fromMicro(y.creditedAmount),
      network: null,
      txHash: null,
      status: null,
    });
  }

  for (const c of commissions) {
    entries.push({
      id: `com_${c.id}`,
      category: "COMMISSION",
      timestamp: c.createdAt.getTime(),
      amount: fromMicro(c.amount),
      network: null,
      txHash: null,
      status: null,
      level: c.level,
      sourceWallet: c.sourceUser.walletAddress,
    });
  }

  for (const t of trades) {
    entries.push({
      id: `trd_${t.id}`,
      category: "TRADE",
      timestamp: t.openedAt.getTime(),
      amount: 0,
      network: null,
      txHash: null,
      status: t.result ?? "OPEN",
      pair: t.pair,
      direction: t.direction,
    });
  }

  for (const a of adjustments) {
    const payload = a.payload as { delta?: number; note?: string };
    entries.push({
      id: `adj_${a.id}`,
      category: "ADJUSTMENT",
      timestamp: a.createdAt.getTime(),
      amount: payload.delta ?? 0,
      network: null,
      txHash: null,
      status: "COMPLETED",
      note: payload.note,
    });
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries;
}
