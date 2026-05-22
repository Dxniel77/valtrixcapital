"use client";

import * as React from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { PAIRS, type PairMeta } from "@/lib/market/pairs";
import { cn, formatNumber } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

interface PairSelectorProps {
  active: PairMeta;
  /** Map of binance symbol → live ticker (price, change). */
  tickers: Record<string, { price: number; changePct: number } | undefined>;
  onChange: (pair: PairMeta) => void;
  className?: string;
}

const TOP_BAR_PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"];

export function PairSelector({
  active,
  tickers,
  onChange,
  className,
}: PairSelectorProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return PAIRS;
    return PAIRS.filter(
      (p) =>
        p.base.includes(q) ||
        p.binance.includes(q) ||
        p.name.toUpperCase().includes(q),
    );
  }, [search]);

  const topPairs = React.useMemo(
    () => PAIRS.filter((p) => TOP_BAR_PAIRS.includes(p.binance)),
    [],
  );

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto", className)}>
      {topPairs.map((p) => {
        const t = tickers[p.binance];
        const isActive = p.binance === active.binance;
        const up = (t?.changePct ?? 0) >= 0;
        return (
          <button
            key={p.binance}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "group flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
              isActive
                ? "border-gold/40 bg-gold/10 text-text-primary"
                : "border-border-subtle bg-bg-base/60 text-text-secondary hover:border-border-strong",
            )}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: p.color }}
            />
            <span className="font-mono">
              {p.base}/{p.quote}
            </span>
            {t ? (
              <span
                className={cn(
                  "font-mono text-[10px]",
                  up ? "text-success" : "text-danger",
                )}
              >
                {up ? "+" : ""}
                {t.changePct.toFixed(2)}%
              </span>
            ) : (
              <span className="font-mono text-[10px] text-text-muted">—</span>
            )}
          </button>
        );
      })}

      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-base/60 px-2.5 py-1.5 text-xs text-text-secondary hover:border-border-strong"
          aria-label={t("trade.addPair")}
        >
          <Plus className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </button>
        {open ? (
          <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-lg border border-border-subtle bg-bg-elevated shadow-elevated">
            <div className="border-b border-border-subtle p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  autoFocus
                  type="search"
                  placeholder={t("trade.searchPair")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-full rounded-md border border-border-subtle bg-bg-base pl-7 pr-2 text-xs text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none"
                />
              </div>
            </div>
            <ul className="max-h-72 overflow-y-auto p-1">
              {filtered.map((p) => {
                const t = tickers[p.binance];
                const up = (t?.changePct ?? 0) >= 0;
                return (
                  <li key={p.binance}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(p);
                        setOpen(false);
                        setSearch("");
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="font-mono">
                          {p.base}/{p.quote}
                        </span>
                        <span className="text-text-muted">{p.name}</span>
                      </span>
                      <span className="flex items-center gap-2 font-mono">
                        {t ? (
                          <>
                            <span className="text-text-primary">
                              {formatNumber(t.price, {
                                decimals: p.pricePrecision,
                              })}
                            </span>
                            <span
                              className={cn(
                                "w-12 text-right",
                                up ? "text-success" : "text-danger",
                              )}
                            >
                              {up ? "+" : ""}
                              {t.changePct.toFixed(2)}%
                            </span>
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-text-muted">
                  {t("trade.noMatchingPairs")}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
