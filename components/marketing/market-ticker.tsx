"use client";

import * as React from "react";

const PAIRS = [
  { symbol: "BTC", base: 67318.3, change: 1.25 },
  { symbol: "ETH", base: 3275.8, change: 0.84 },
  { symbol: "BNB", base: 612.4, change: -0.42 },
  { symbol: "SOL", base: 186.55, change: 2.18 },
  { symbol: "XRP", base: 0.5612, change: 1.02 },
  { symbol: "MATIC", base: 0.4823, change: -0.65 },
  { symbol: "AVAX", base: 38.7, change: 1.55 },
  { symbol: "ADA", base: 0.3815, change: 0.32 },
];

export function MarketTicker() {
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setNow((v) => v + 1), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="border-y border-border-subtle bg-bg-elevated/40">
      <div className="container">
        <div className="scroll-fade-x relative overflow-hidden py-2">
          <div className="flex animate-[ticker_38s_linear_infinite] gap-8 whitespace-nowrap">
            {[...PAIRS, ...PAIRS, ...PAIRS].map((p, i) => {
              const jitter = ((now + i) % 5) * 0.04 - 0.08;
              const price =
                p.base * (1 + (p.change / 100) + jitter / 100);
              const up = p.change + jitter >= 0;
              return (
                <span
                  key={`${p.symbol}-${i}`}
                  className="inline-flex items-center gap-2 text-xs"
                >
                  <span className="font-mono text-text-secondary">
                    {p.symbol}/USDT
                  </span>
                  <span className="font-mono text-text-primary">
                    ${price.toLocaleString(undefined, {
                      minimumFractionDigits: price < 5 ? 4 : 2,
                      maximumFractionDigits: price < 5 ? 4 : 2,
                    })}
                  </span>
                  <span
                    className={`font-mono ${
                      up ? "text-success" : "text-danger"
                    }`}
                  >
                    {up ? "+" : ""}
                    {(p.change + jitter).toFixed(2)}%
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
