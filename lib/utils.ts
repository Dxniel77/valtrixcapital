import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const USDT_DECIMALS = 6;
const USDT_SCALE = 10n ** BigInt(USDT_DECIMALS);

/** Convert micro-USDT (BigInt) → human number (USDT). */
export function fromMicro(value: bigint): number {
  const whole = value / USDT_SCALE;
  const frac = value % USDT_SCALE;
  return Number(whole) + Number(frac) / Number(USDT_SCALE);
}

/** Convert human USDT number → micro-USDT BigInt. */
export function toMicro(value: number): bigint {
  return BigInt(Math.round(value * Number(USDT_SCALE)));
}

export function formatUsd(
  value: number,
  options: { decimals?: number; compact?: boolean } = {},
): string {
  const { decimals = 2, compact = false } = options;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatNumber(
  value: number,
  options: { decimals?: number; compact?: boolean } = {},
): string {
  const { decimals = 2, compact = false } = options;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function shortenHash(hash: string): string {
  return shortenAddress(hash, 10, 8);
}

export function explorerUrl(network: "BSC" | "POLYGON", txHash: string) {
  const base =
    network === "BSC" ? "https://bscscan.com/tx/" : "https://polygonscan.com/tx/";
  return base + txHash;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function nextUtcMidnightMs(now = Date.now()): number {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime() - now;
}
