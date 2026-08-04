import type { Direction, Trade } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPlatformConfig } from "@/lib/services/config";
import type { TradeDto } from "@/lib/trade/trade-types";
import { fromMicro } from "@/lib/utils";
import { reconcileUserWinBonuses } from "@/lib/services/trade-bonuses";
import { distributeReferralCommissions } from "@/lib/services/commissions";
import {
  commissionableAmountMicro,
  getOperationalBonusCapitalMicro,
} from "@/lib/services/sponsored-capital";
import { getUserIbYieldBoost } from "@/lib/services/ib-strategy";

const SIMULTANEOUS_TIER_MID_MIN = 501;
const SIMULTANEOUS_TIER_HIGH_MIN = 1001;
const PAYOUT_CAP_MULTIPLIER = 2;

export class TradeServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "NO_CAPITAL"
      | "DAILY_LIMIT"
      | "SIMULTANEOUS_LIMIT"
      | "HEDGE_BLOCKED"
      | "ALREADY_RESOLVED"
      | "INVALID_PAIR"
      | "INACTIVE",
  ) {
    super(message);
    this.name = "TradeServiceError";
  }
}

export type { TradeDto } from "@/lib/trade/trade-types";

function utcDayKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function maxSimultaneousTrades(capitalUsdt: number, minStake: number): number {
  if (capitalUsdt < minStake) return 0;
  if (capitalUsdt >= SIMULTANEOUS_TIER_HIGH_MIN) return 7;
  if (capitalUsdt >= SIMULTANEOUS_TIER_MID_MIN) return 5;
  return 3;
}

function resolveTradeOutcome(
  direction: Direction,
  entryPrice: number,
  exitPrice: number,
): "WIN" | "LOSS" {
  const movedUp = exitPrice > entryPrice;
  const movedDown = exitPrice < entryPrice;
  if (direction === "UP") return movedUp ? "WIN" : "LOSS";
  return movedDown ? "WIN" : "LOSS";
}

function serializeTrade(trade: Trade): TradeDto {
  return {
    id: trade.id,
    pair: trade.pair,
    direction: trade.direction,
    entryPrice: Number(trade.entryPrice),
    exitPrice: trade.exitPrice !== null ? Number(trade.exitPrice) : null,
    durationSec: trade.durationSec,
    openedAt: trade.openedAt.getTime(),
    resolvedAt: trade.resolvedAt?.getTime() ?? null,
    status: trade.result ?? "OPEN",
    bonusAppliedBps: trade.bonusAppliedBps,
    capitalSnapshotAtWin: fromMicro(trade.capitalSnapshotAtWin),
    bonusCredited: fromMicro(trade.bonusCredited),
  };
}

function applyEarningsCredit(
  totalEarned: bigint,
  payoutCap: bigint,
  amountMicro: bigint,
): bigint {
  if (payoutCap <= 0n) return 0n;
  const room = payoutCap - totalEarned;
  if (room <= 0n) return 0n;
  return amountMicro > room ? room : amountMicro;
}

export async function listUserTrades(userId: string, limit = 500): Promise<TradeDto[]> {
  await reconcileUserWinBonuses(userId);

  const rows = await prisma.trade.findMany({
    where: { userId },
    orderBy: { openedAt: "desc" },
    take: limit,
  });
  return rows.map(serializeTrade);
}

export async function openTrade(input: {
  userId: string;
  pair: string;
  direction: Direction;
  entryPrice: number;
  durationSec: number;
}): Promise<TradeDto> {
  const config = await getPlatformConfig();

  if (!config.allowedPairs.includes(input.pair)) {
    throw new TradeServiceError("Pair not allowed", "INVALID_PAIR");
  }

  // Serialize opens per user so concurrent requests cannot both pass the
  // daily/simultaneous count checks (TOCTOU → 8/7 style overshoots).
  const trade = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; isActive: boolean; lockedCapital: bigint }>>`
      SELECT id, "isActive", "lockedCapital"
      FROM "User"
      WHERE id = ${input.userId}
      FOR UPDATE
    `;
    const user = locked[0];
    if (!user) throw new TradeServiceError("User not found", "NOT_FOUND");
    if (!user.isActive) throw new TradeServiceError("Account inactive", "INACTIVE");

    const capital = fromMicro(user.lockedCapital);
    const maxTrades = maxSimultaneousTrades(capital, config.minStake);
    if (maxTrades <= 0) {
      throw new TradeServiceError("No staked capital", "NO_CAPITAL");
    }

    const dayStart = new Date(`${utcDayKey()}T00:00:00.000Z`);
    const dayEnd = new Date(`${utcDayKey()}T23:59:59.999Z`);

    const [todayCount, openCount, oppositeOpen] = await Promise.all([
      tx.trade.count({
        where: {
          userId: input.userId,
          openedAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      tx.trade.count({
        where: { userId: input.userId, result: null },
      }),
      tx.trade.findFirst({
        where: {
          userId: input.userId,
          pair: input.pair,
          result: null,
          direction: input.direction === "UP" ? "DOWN" : "UP",
        },
      }),
    ]);

    if (todayCount >= maxTrades) {
      throw new TradeServiceError("Daily trade limit reached", "DAILY_LIMIT");
    }
    if (openCount >= maxTrades) {
      throw new TradeServiceError("Simultaneous trade limit reached", "SIMULTANEOUS_LIMIT");
    }
    if (oppositeOpen) {
      throw new TradeServiceError("Opposite direction already open", "HEDGE_BLOCKED");
    }

    return tx.trade.create({
      data: {
        userId: input.userId,
        pair: input.pair,
        direction: input.direction,
        entryPrice: input.entryPrice,
        durationSec: input.durationSec,
      },
    });
  });

  return serializeTrade(trade);
}

export async function resolveTrade(input: {
  userId: string;
  tradeId: string;
  exitPrice: number;
}): Promise<TradeDto> {
  const config = await getPlatformConfig();
  const trade = await prisma.trade.findFirst({
    where: { id: input.tradeId, userId: input.userId },
  });
  if (!trade) throw new TradeServiceError("Trade not found", "NOT_FOUND");
  if (trade.result !== null) {
    throw new TradeServiceError("Trade already resolved", "ALREADY_RESOLVED");
  }

  const result = resolveTradeOutcome(trade.direction, Number(trade.entryPrice), input.exitPrice);
  const now = new Date();

  if (result === "LOSS") {
    const updated = await prisma.trade.update({
      where: { id: trade.id },
      data: {
        result: "LOSS",
        exitPrice: input.exitPrice,
        resolvedAt: now,
      },
    });
    return serializeTrade(updated);
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  const capitalMicro = await getOperationalBonusCapitalMicro(
    user.id,
    user.accountGranted,
  );
  const payoutCap =
    user.payoutCap > 0n
      ? user.payoutCap
      : capitalMicro * BigInt(PAYOUT_CAP_MULTIPLIER);
  const ibBoost = await getUserIbYieldBoost(user.id);
  const effectiveWinBps =
    config.bonusPerWinBps + ibBoost.tradeBonusExtraBps;
  const bonusMicro =
    capitalMicro > 0n
      ? (capitalMicro * BigInt(effectiveWinBps)) / 10_000n
      : 0n;
  const applied = applyEarningsCredit(user.totalEarned, payoutCap, bonusMicro);
  const payableMicro =
    applied > 0n && !user.accountGranted
      ? await commissionableAmountMicro(user.id, applied)
      : 0n;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.trade.update({
      where: { id: trade.id },
      data: {
        result: "WIN",
        exitPrice: input.exitPrice,
        resolvedAt: now,
        bonusAppliedBps: effectiveWinBps,
        capitalSnapshotAtWin: capitalMicro,
        bonusCredited: applied,
      },
    });

    if (applied > 0n) {
      const nextEarned = user.totalEarned + applied;
      await tx.user.update({
        where: { id: user.id },
        data: {
          earningsBalance: user.earningsBalance + applied,
          totalEarned: nextEarned,
        },
      });

      if (payoutCap > 0n && nextEarned >= payoutCap) {
        await tx.stake.updateMany({
          where: { userId: user.id, status: "ACTIVE" },
          data: { status: "COMPLETED", completedAt: now },
        });
      }
    }

    return row;
  });

  if (payableMicro > 0n) {
    await distributeReferralCommissions({
      sourceUserId: user.id,
      amountMicro: applied,
      ratesBps: config.commissionRatesBps,
      sourceTradeId: updated.id,
      payableMicro,
    });
  }

  return serializeTrade(updated);
}
