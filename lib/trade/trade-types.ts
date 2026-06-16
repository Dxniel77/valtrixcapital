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
}
