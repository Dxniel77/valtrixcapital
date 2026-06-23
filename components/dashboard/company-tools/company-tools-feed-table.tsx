"use client";

import * as React from "react";
import { ExternalLink, Zap, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle } from "@/components/ui/card";
import type { PairMeta } from "@/lib/market/pairs";
import {
  cn,
  explorerName,
  explorerUrl,
  formatNumber,
  networkLabel,
  shortenHash,
} from "@/lib/utils";

export const COMPANY_FEED_LIST_CLASS =
  "max-h-[32rem] divide-y divide-border-subtle overflow-y-auto";

/** Liquidation feed — 6 columns. */
export const LIQUIDATION_FEED_GRID =
  "md:grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.7fr_1fr]";

/** Bot feed — 7 columns (direction + entry/volume/pnl + network/tx). */
export const BOT_FEED_GRID =
  "md:grid-cols-[1fr_0.55fr_0.75fr_0.75fr_0.85fr_0.65fr]";

export interface FeedTimeLabels {
  secondsAgo: (n: number) => string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
}

export function CompanyFeedCardHeader({
  title,
  hint,
  hintIcon: HintIcon = Zap,
}: {
  title: string;
  hint?: string;
  hintIcon?: LucideIcon;
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle>{title}</CardTitle>
      {hint ? (
        <span className="inline-flex items-center gap-1 text-xs text-text-muted">
          <HintIcon className="h-3.5 w-3.5 text-gold" />
          {hint}
        </span>
      ) : null}
    </CardHeader>
  );
}

export function CompanyFeedTableHeader({
  gridClass,
  children,
}: {
  gridClass: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "hidden gap-3 border-b border-border-subtle px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted md:grid",
        gridClass,
      )}
    >
      {children}
    </div>
  );
}

export function CompanyFeedRow({
  gridClass,
  isNewest,
  children,
}: {
  gridClass: string;
  isNewest?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-2 items-center gap-3 px-3 py-2.5 text-sm",
        gridClass,
        isNewest && "animate-fade-in bg-gold/[0.03]",
      )}
    >
      {children}
    </li>
  );
}

export function CompanyFeedPairCell({
  pair,
  symbol,
}: {
  pair?: PairMeta;
  symbol: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-6 w-6 shrink-0 rounded-full"
        style={{ background: `${pair?.color ?? "#888"}33` }}
        aria-hidden
      />
      <span className="font-mono text-text-primary">
        {pair?.base ?? symbol.replace("USDT", "")}/USDT
      </span>
    </div>
  );
}

export function CompanyFeedNumericCell({
  children,
  className,
  title,
  mobileSpan = false,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  mobileSpan?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono text-text-primary md:text-right",
        mobileSpan && "col-span-2 md:col-span-1",
        className,
      )}
      title={title}
    >
      {children}
    </span>
  );
}

export function CompanyFeedNetworkBadge({
  network,
}: {
  network: "BSC" | "POLYGON";
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] uppercase",
        network === "BSC" ? "text-warning" : "text-info",
      )}
    >
      {networkLabel(network)}
    </Badge>
  );
}

export function CompanyFeedTimeCell({
  ts,
  labels,
}: {
  ts: number;
  labels: FeedTimeLabels;
}) {
  return (
    <span className="hidden font-mono text-xs text-text-muted md:block md:text-right">
      <CompanyFeedRelativeTime ts={ts} labels={labels} />
    </span>
  );
}

export function CompanyFeedTxCell({
  network,
  txHash,
}: {
  network: "BSC" | "POLYGON";
  txHash: string;
}) {
  return (
    <div className="col-span-2 flex flex-col items-end gap-1 md:col-span-1">
      <span className="font-mono text-[10px] text-text-muted md:hidden">
        {networkLabel(network)}
      </span>
      <a
        href={explorerUrl(network, txHash)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center justify-end gap-1 font-mono text-xs text-gold hover:text-gold-bright"
        title={`${explorerName(network)} · ${txHash}`}
      >
        <span className="truncate">{shortenHash(txHash)}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    </div>
  );
}

export function CompanyFeedRelativeTime({
  ts,
  labels,
}: {
  ts: number;
  labels: FeedTimeLabels;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 60) return <>{labels.secondsAgo(sec)}</>;
  const min = Math.floor(sec / 60);
  if (min < 60) return <>{labels.minutesAgo(min)}</>;
  const hr = Math.floor(min / 60);
  return <>{labels.hoursAgo(hr)}</>;
}

export function CompanyFeedSkeleton({ rows = 16 }: { rows?: number }) {
  return (
    <ul className={COMPANY_FEED_LIST_CLASS}>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-6 w-6 animate-pulse rounded-full bg-bg-hover" />
          <div className="h-4 flex-1 animate-pulse rounded bg-bg-hover" />
        </li>
      ))}
    </ul>
  );
}

export function formatFeedUsd(
  value: number,
  decimals: number,
  signed = false,
): string {
  const prefix = signed && value >= 0 ? "+" : signed && value < 0 ? "-" : "";
  return `${prefix}$${formatNumber(Math.abs(value), { decimals })}`;
}
