"use client";

import dynamic from "next/dynamic";

export type { TradingChartHandle } from "./trading-chart";

export const TradingChart = dynamic(
  () =>
    import("./trading-chart").then((mod) => ({
      default: mod.TradingChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[420px] animate-pulse rounded-lg border border-border-subtle bg-bg-base/60"
        aria-hidden
      />
    ),
  },
);
