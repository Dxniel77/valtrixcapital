export interface TradeDto {
  id: string;
  pair: string;
  direction: "UP" | "DOWN";
  entryPrice: number;
  exitPrice: number | null;
  durationSec: number;
  openedAt: number;
  resolvedAt: number | null;
  status: "OPEN" | "WIN" | "LOSS";
  bonusAppliedBps: number;
  /** Active capital (USDT) when the win was credited. */
  capitalSnapshotAtWin: number;
  /** Operational bonus credited for this win (USDT). */
  bonusCredited: number;
}
