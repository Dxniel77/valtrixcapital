export type CopyMarket = {
  symbol: string;
  short: string;
  basePrice: number;
};

/**
 * Pairs the live copy engine can open.
 * `basePrice` is a last-resort fallback when the live ticker is unavailable.
 */
export const COPY_MARKETS: CopyMarket[] = [
  { symbol: "BTCUSDT", short: "BTC", basePrice: 114_250 },
  { symbol: "ETHUSDT", short: "ETH", basePrice: 3_720 },
  { symbol: "BNBUSDT", short: "BNB", basePrice: 762 },
  { symbol: "SOLUSDT", short: "SOL", basePrice: 171 },
  { symbol: "XRPUSDT", short: "XRP", basePrice: 3.04 },
  { symbol: "ADAUSDT", short: "ADA", basePrice: 0.76 },
  { symbol: "DOGEUSDT", short: "DOGE", basePrice: 0.22 },
  { symbol: "TRXUSDT", short: "TRX", basePrice: 0.33 },
  { symbol: "LINKUSDT", short: "LINK", basePrice: 18.4 },
  { symbol: "AVAXUSDT", short: "AVAX", basePrice: 24.8 },
];

export const DEFAULT_ACTIVE_SYMBOLS = COPY_MARKETS.map((market) => market.symbol);

const ALLOWED = new Set(DEFAULT_ACTIVE_SYMBOLS);

export function isCopyMarketSymbol(symbol: string): boolean {
  return ALLOWED.has(symbol.trim().toUpperCase());
}

export function normalizeActiveSymbols(
  symbols: string[] | null | undefined,
): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of symbols ?? []) {
    const symbol = raw.trim().toUpperCase();
    if (!ALLOWED.has(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    unique.push(symbol);
  }
  return unique.length > 0 ? unique : [...DEFAULT_ACTIVE_SYMBOLS];
}

export function marketsFromSymbols(symbols: string[] | null | undefined): CopyMarket[] {
  const active = new Set(normalizeActiveSymbols(symbols));
  return COPY_MARKETS.filter((market) => active.has(market.symbol));
}

export function pickMarket(
  digest: Buffer,
  markets: CopyMarket[],
): CopyMarket {
  const pool = markets.length > 0 ? markets : COPY_MARKETS;
  return pool[digest[0] % pool.length] ?? COPY_MARKETS[0]!;
}
