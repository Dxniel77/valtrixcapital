export type LiquidationNetwork = "BSC" | "POLYGON";

/** On-chain USDT transfer used by the liquidation engine feed. */
export interface LiquidationChainTx {
  hash: string;
  executedAt: number;
  /** Human-readable USDT amount — matches what explorers show for the transfer. */
  amountUsdt: number;
  network: LiquidationNetwork;
}

export interface LiquidationEvent {
  id: string;
  pair: string;
  network: LiquidationNetwork;
  txHash: string;
  /** On-chain USDT settlement amount (verifiable). */
  amountUsdt: number;
  /** Company fee earned from processing this settlement. */
  feeUsd: number;
  executedAt: number;
  /** UTC day key when fee was credited. */
  feeDay?: string;
}

export type LiquidationCadence = "fast" | "normal" | "slow";
