import type { Ticker } from "./types";
import type { MarketSource } from "./pairs";

/** Server-proxied ticker poll — works when exchange WebSockets are geo-blocked. */
export async function fetchTickerViaApi(
  symbol: string,
  preferredSource?: MarketSource | null,
): Promise<{ ticker: Ticker; source: MarketSource } | null> {
  const params = new URLSearchParams({ symbol });
  if (preferredSource) params.set("source", preferredSource);
  const res = await fetch(`/api/market/ticker?${params}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<{ ticker: Ticker; source: MarketSource }>;
}

export function startTickerPoll(
  symbol: string,
  preferredSource: MarketSource | null | undefined,
  onTick: (ticker: Ticker, source: MarketSource) => void,
  intervalMs = 4_000,
): () => void {
  let cancelled = false;

  async function tick() {
    if (cancelled) return;
    const result = await fetchTickerViaApi(symbol, preferredSource);
    if (!cancelled && result) onTick(result.ticker, result.source);
  }

  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

export function startMultiTickerPoll(
  symbols: string[],
  onTick: (symbol: string, ticker: Ticker, source: MarketSource) => void,
  intervalMs = 5_000,
): () => void {
  let cancelled = false;

  async function tick() {
    if (cancelled) return;
    await Promise.all(
      symbols.map(async (symbol) => {
        const result = await fetchTickerViaApi(symbol);
        if (!cancelled && result) onTick(symbol, result.ticker, result.source);
      }),
    );
  }

  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}
