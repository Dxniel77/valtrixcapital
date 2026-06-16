import type { AdminMovement } from "@/lib/admin/store";

export function utcDateKey(ts = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function utcDayBounds(dayKey: string): { start: number; end: number } {
  const start = Date.parse(`${dayKey}T00:00:00.000Z`);
  const end = start + 86_400_000 - 1;
  return { start, end };
}

export function isMovementOnDay(m: AdminMovement, dayKey: string): boolean {
  return utcDateKey(m.timestamp) === dayKey;
}

export function filterMovementsByDay(
  movements: AdminMovement[],
  dayKey: string,
): AdminMovement[] {
  return movements
    .filter((m) => isMovementOnDay(m, dayKey))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export interface DailyMovementSummary {
  dayKey: string;
  count: number;
  deposits: number;
  withdrawals: number;
  yields: number;
  commissions: number;
  depositTotal: number;
  withdrawalTotal: number;
  yieldTotal: number;
  commissionTotal: number;
  netFlow: number;
}

export function summarizeDailyMovements(
  movements: AdminMovement[],
  dayKey: string,
): DailyMovementSummary {
  const rows = filterMovementsByDay(movements, dayKey);
  let deposits = 0;
  let withdrawals = 0;
  let yields = 0;
  let commissions = 0;
  let depositTotal = 0;
  let withdrawalTotal = 0;
  let yieldTotal = 0;
  let commissionTotal = 0;

  for (const m of rows) {
    switch (m.type) {
      case "DEPOSIT":
        deposits += 1;
        depositTotal += m.amount;
        break;
      case "WITHDRAWAL":
        withdrawals += 1;
        withdrawalTotal += m.amount;
        break;
      case "YIELD":
        yields += 1;
        yieldTotal += m.amount;
        break;
      case "COMMISSION":
        commissions += 1;
        commissionTotal += m.amount;
        break;
      default:
        break;
    }
  }

  return {
    dayKey,
    count: rows.length,
    deposits,
    withdrawals,
    yields,
    commissions,
    depositTotal,
    withdrawalTotal,
    yieldTotal,
    commissionTotal,
    netFlow: depositTotal + yieldTotal + commissionTotal - withdrawalTotal,
  };
}

export function formatMovementDayLabel(
  dayKey: string,
  locale = "es-ES",
): string {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  return date.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
