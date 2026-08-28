import { resolveTicker } from "@/lib/exchanges/resolve-market";
import {
  catalogFallbackPrice,
  isCatalogDemoPrice,
  roundCopyPrice,
} from "./copy-price";

const CACHE_TTL_MS = 15_000;

const cache = new Map<string, { price: number; fetchedAt: number }>();
const inflight = new Map<string, Promise<number | null>>();

export async function fetchLiveCopyPrice(symbol: string): Promise<number | null> {
  const key = symbol.trim().toUpperCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.price;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data } = await resolveTicker(key);
      const price = Number(data.price);
      if (!Number.isFinite(price) || price <= 0) return null;
      const rounded = roundCopyPrice(price);
      cache.set(key, { price: rounded, fetchedAt: Date.now() });
      return rounded;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

/**
 * Prefer a live USDT last price. Catalog `basePrice` is only used when the
 * ticker is down. A submitted price that is just the catalog stub is ignored.
 */
export async function resolveCopyEntryPrice(
  symbol: string,
  submitted?: number,
): Promise<number> {
  const normalized = symbol.trim().toUpperCase();
  const submittedOk =
    submitted != null && Number.isFinite(submitted) && submitted > 0;

  if (submittedOk && !isCatalogDemoPrice(normalized, submitted)) {
    return roundCopyPrice(submitted);
  }

  const live = await fetchLiveCopyPrice(normalized);
  if (live != null && live > 0) return live;
  if (submittedOk) return roundCopyPrice(submitted);

  const fallback = catalogFallbackPrice(normalized);
  if (fallback != null && fallback > 0) return roundCopyPrice(fallback);
  throw new Error(`No price available for ${normalized}`);
}
