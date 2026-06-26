import type { Candle, Ticker } from "./types";

import type { MarketSource } from "./pairs";

export type StreamEvent =
  | { type: "candle"; candle: Candle; closed: boolean }
  | { type: "ticker"; ticker: Ticker }
  | { type: "open"; source: MarketSource }
  | { type: "close" }
  | { type: "error"; message: string };

export interface StreamHandle {
  close: () => void;
}

export interface StreamOptions {
  /** Max ms to wait for WS open before emitting error (default 8000). */
  connectTimeoutMs?: number;
  /** Reconnect after a successful session drops (default true). */
  reconnect?: boolean;
}
