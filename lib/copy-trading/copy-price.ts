import { COPY_MARKETS } from "./markets";

/** Catalog prices are fallbacks only. ±3% covers the old simulated fill noise. */
const CATALOG_DEMO_TOLERANCE = 0.03;

export function catalogFallbackPrice(symbol: string): number | null {
  const market = COPY_MARKETS.find(
    (row) => row.symbol === symbol.trim().toUpperCase(),
  );
  return market?.basePrice ?? null;
}

export function isCatalogDemoPrice(symbol: string, price: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  const fallback = catalogFallbackPrice(symbol);
  if (fallback == null || fallback <= 0) return false;
  return Math.abs(price / fallback - 1) <= CATALOG_DEMO_TOLERANCE;
}

export function roundCopyPrice(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  if (price >= 100) return Math.round(price * 100) / 100;
  if (price >= 1) return Math.round(price * 10_000) / 10_000;
  return Math.round(price * 1_000_000) / 1_000_000;
}

export function formatCopyPriceInput(price: number): string {
  const rounded = roundCopyPrice(price);
  if (!Number.isFinite(rounded) || rounded <= 0) return "";
  if (rounded >= 100) return rounded.toFixed(2);
  if (rounded >= 1) return rounded.toFixed(4);
  return rounded.toFixed(6);
}
