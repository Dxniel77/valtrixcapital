export type ChartPoint = { time: number; price: number };

export type DrawingTool =
  | "cursor"
  | "hline"
  | "trend"
  | "rect"
  | "fib";

export type ChartDrawing =
  | { id: string; type: "hline"; price: number; color: string }
  | { id: string; type: "trend"; p1: ChartPoint; p2: ChartPoint; color: string }
  | { id: string; type: "rect"; p1: ChartPoint; p2: ChartPoint; color: string }
  | { id: string; type: "fib"; p1: ChartPoint; p2: ChartPoint; color: string };

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

export const DRAWING_COLORS = [
  "#D4AF37",
  "#26C6DA",
  "#A855F7",
  "#F97316",
  "#22C55E",
  "#FF6B6B",
] as const;

const STORAGE_PREFIX = "valtrix-chart-drawings:";
const TOOLBAR_VISIBLE_KEY = "valtrix-chart-drawing-toolbar-visible";

export function loadDrawingToolbarVisible(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(TOOLBAR_VISIBLE_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function saveDrawingToolbarVisible(visible: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOOLBAR_VISIBLE_KEY, visible ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function storageKey(symbol: string, timeframe: string) {
  return `${STORAGE_PREFIX}${symbol}:${timeframe}`;
}

export function loadDrawings(
  symbol: string,
  timeframe: string,
): ChartDrawing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(symbol, timeframe));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChartDrawing[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDrawings(
  symbol: string,
  timeframe: string,
  drawings: ChartDrawing[],
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      storageKey(symbol, timeframe),
      JSON.stringify(drawings),
    );
  } catch {
    /* ignore quota */
  }
}

export function createDrawingId() {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fibPriceAtLevel(
  high: number,
  low: number,
  level: number,
): number {
  return high - (high - low) * level;
}
