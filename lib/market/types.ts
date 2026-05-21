export interface Candle {
  /** Unix seconds (UTC). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  /** 24h % change. */
  changePct: number;
  /** 24h volume (quote, USDT). */
  volume: number;
  /** Last update ts (ms). */
  ts: number;
}
