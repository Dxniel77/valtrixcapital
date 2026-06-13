"use client";

import * as React from "react";

import { PAIRS } from "@/lib/market/pairs";
import { useTickers } from "@/lib/market/use-tickers";
import { formatNumber, formatPercent } from "@/lib/utils";

export function MarketTicker() {
  const symbols = React.useMemo(() => PAIRS.map((p) => p.binance), []);
  const tickers = useTickers(symbols);
  const items = React.useMemo(() => [...PAIRS, ...PAIRS, ...PAIRS], []);

  return (
    <div className="border-y border-border-subtle bg-bg-elevated/40">
      <div className="container">
        <div className="scroll-fade-x relative overflow-hidden py-2">
          <div className="flex animate-[ticker_38s_linear_infinite] gap-8 whitespace-nowrap">
            {items.map((p, i) => {
              const tick = tickers[p.binance];
              const label = p.displayBase ?? p.base;
              const up = (tick?.changePct ?? 0) >= 0;

              return (
                <span
                  key={`${p.binance}-${i}`}
                  className="inline-flex items-center gap-2 text-xs"
                >
                  <span className="font-mono text-text-secondary">
                    {label}/USDT
                  </span>
                  <span className="font-mono text-text-primary">
                    {tick
                      ? `$${formatNumber(tick.price, {
                          decimals: p.pricePrecision,
                        })}`
                      : "—"}
                  </span>
                  <span
                    className={`font-mono ${
                      tick
                        ? up
                          ? "text-success"
                          : "text-danger"
                        : "text-text-muted"
                    }`}
                  >
                    {tick ? formatPercent(tick.changePct) : "—"}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
      `}</style>
    </div>
  );
}
