export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";

export const TIMEFRAMES: { value: Timeframe; label: string; seconds: number }[] = [
  { value: "1m", label: "1m", seconds: 60 },
  { value: "5m", label: "5m", seconds: 300 },
  { value: "15m", label: "15m", seconds: 900 },
  { value: "1h", label: "1h", seconds: 3600 },
  { value: "4h", label: "4h", seconds: 14400 },
  { value: "1D", label: "1D", seconds: 86400 },
];

export const BINANCE_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1D": "1d",
};

export type MarketSource = "binance" | "bybit";

export interface PairMeta {
  /** Display ticker, e.g. "BTC". */
  base: string;
  /** Quote currency, almost always USDT. */
  quote: string;
  /** Binance symbol, e.g. "BTCUSDT". */
  binance: string;
  /** Bybit symbol — usually same. */
  bybit: string;
  /** Display name. */
  name: string;
  /** Price precision (digits after decimal) for display. */
  pricePrecision: number;
  /** Hex color used on the pair chip. */
  color: string;
  /** Demo leverage label shown in the symbol picker. */
  leverage: string;
}

/** Blofin-style perpetual symbol label, e.g. BTC-USDT-SWAP. */
export function formatSwapSymbol(pair: PairMeta): string {
  return `${pair.base}-${pair.quote}-SWAP`;
}

export const PAIRS: PairMeta[] = [
  {
    base: "BTC",
    quote: "USDT",
    binance: "BTCUSDT",
    bybit: "BTCUSDT",
    name: "Bitcoin",
    pricePrecision: 2,
    color: "#F7931A",
    leverage: "100X",
  },
  {
    base: "ETH",
    quote: "USDT",
    binance: "ETHUSDT",
    bybit: "ETHUSDT",
    name: "Ethereum",
    pricePrecision: 2,
    color: "#627EEA",
    leverage: "100X",
  },
  {
    base: "BNB",
    quote: "USDT",
    binance: "BNBUSDT",
    bybit: "BNBUSDT",
    name: "BNB",
    pricePrecision: 2,
    color: "#F0B90B",
    leverage: "50X",
  },
  {
    base: "SOL",
    quote: "USDT",
    binance: "SOLUSDT",
    bybit: "SOLUSDT",
    name: "Solana",
    pricePrecision: 2,
    color: "#9945FF",
    leverage: "50X",
  },
  {
    base: "XRP",
    quote: "USDT",
    binance: "XRPUSDT",
    bybit: "XRPUSDT",
    name: "XRP",
    pricePrecision: 4,
    color: "#23292F",
    leverage: "50X",
  },
  {
    base: "MATIC",
    quote: "USDT",
    binance: "MATICUSDT",
    bybit: "MATICUSDT",
    name: "Polygon",
    pricePrecision: 4,
    color: "#8247E5",
    leverage: "25X",
  },
  {
    base: "ADA",
    quote: "USDT",
    binance: "ADAUSDT",
    bybit: "ADAUSDT",
    name: "Cardano",
    pricePrecision: 4,
    color: "#0033AD",
    leverage: "25X",
  },
  {
    base: "AVAX",
    quote: "USDT",
    binance: "AVAXUSDT",
    bybit: "AVAXUSDT",
    name: "Avalanche",
    pricePrecision: 3,
    color: "#E84142",
    leverage: "25X",
  },
];

export function findPair(binance: string): PairMeta | undefined {
  return PAIRS.find((p) => p.binance === binance);
}

export const DEFAULT_PAIR = PAIRS[0];
export const DEFAULT_TIMEFRAME: Timeframe = "1m";

export const TRADE_DURATIONS: { seconds: number; label: string }[] = [
  { seconds: 60, label: "1m" },
  { seconds: 120, label: "2m" },
  { seconds: 180, label: "3m" },
  { seconds: 300, label: "5m" },
];
