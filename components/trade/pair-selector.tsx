"use client";

import * as React from "react";
import { ChevronDown, Search, Star } from "lucide-react";
import {
  PAIRS,
  formatSwapSymbol,
  pairMatchesSearch,
  type MarketSource,
  type PairMeta,
} from "@/lib/market/pairs";
import {
  readPairFavorites,
  togglePairFavorite,
} from "@/lib/market/pair-favorites";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

type ExchangeTab = "favorites" | MarketSource;

interface PairSelectorProps {
  active: PairMeta;
  /** Live feed source shown on the trigger badge. */
  source?: MarketSource | null;
  tickers: Record<string, { price: number; changePct: number } | undefined>;
  onChange: (pair: PairMeta) => void;
  className?: string;
}

const EXCHANGE_TABS: ExchangeTab[] = ["favorites", "binance"];

export function PairSelector({
  active,
  source,
  tickers,
  onChange,
  className,
}: PairSelectorProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState<ExchangeTab>("binance");
  const [favorites, setFavorites] = React.useState<string[]>([]);

  React.useEffect(() => {
    setFavorites(readPairFavorites());
  }, [open]);

  const exchangeLabel =
    source === "bybit"
      ? t("trade.exchangeBybit")
      : t("trade.exchangeBinance");

  const filtered = React.useMemo(() => {
    let list = PAIRS;
    if (tab === "favorites") {
      list = PAIRS.filter(
        (p) =>
          favorites.includes(p.binance) ||
          favorites.includes(p.bybit),
      );
    }
    if (!search.trim()) return list;
    return list.filter((p) => pairMatchesSearch(p, search));
  }, [search, tab, favorites]);

  const handleToggleFavorite = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(togglePairFavorite(symbol));
  };

  const selectPair = (p: PairMeta) => {
    onChange(p);
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border-strong bg-bg-base/80 px-3 py-1.5 text-sm transition-colors hover:border-[#FB923C]/40 hover:bg-bg-hover",
          className,
        )}
        aria-label={t("trade.selectSymbol")}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        <span className="font-mono font-medium text-text-primary">
          {formatSwapSymbol(active)}
        </span>
        <span className="rounded bg-[#F97316] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {exchangeLabel}
        </span>
        <ChevronDown className="h-4 w-4 text-text-muted" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showClose
          className="max-w-[440px] gap-0 p-0"
        >
          <DialogTitle className="sr-only">{t("trade.selectSymbol")}</DialogTitle>

          {/* Exchange tabs */}
          <div className="border-b border-border-subtle px-3 pt-4">
            <div className="scroll-fade-x flex gap-1 overflow-x-auto pb-2">
              {EXCHANGE_TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === id
                      ? "bg-bg-hover text-text-primary"
                      : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  {id === "favorites"
                    ? t("trade.exchangeFavorites")
                    : id === "binance"
                      ? t("trade.exchangeBinance")
                      : t("trade.exchangeBybit")}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="border-b border-border-subtle p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                autoFocus
                type="search"
                placeholder={t("trade.searchSymbolsPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-bg-base pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-[#FB923C]/50 focus:outline-none focus:ring-1 focus:ring-[#FB923C]/30"
              />
            </div>
          </div>

          {/* Symbol list */}
          <ul className="max-h-[min(420px,55vh)] overflow-y-auto py-1">
            {filtered.map((p) => {
              const isActive = p.binance === active.binance;
              const isFavorite = favorites.includes(p.binance);
              const tick = tickers[p.binance];
              const up = (tick?.changePct ?? 0) >= 0;

              return (
                <li key={p.binance}>
                  <div
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 transition-colors",
                      isActive ? "bg-bg-hover" : "hover:bg-bg-hover/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(p.binance, e)}
                      className="shrink-0 rounded p-0.5 text-text-muted hover:text-[#FB923C]"
                      aria-label={
                        isFavorite
                          ? t("trade.removeFavorite")
                          : t("trade.addFavorite")
                      }
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          isFavorite && "fill-[#FB923C] text-[#FB923C]",
                        )}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => selectPair(p)}
                      className="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto_3.5rem] items-center gap-2 text-left"
                    >
                      <span
                        className={cn(
                          "truncate font-mono text-sm",
                          isActive ? "text-[#FB923C]" : "text-text-primary",
                        )}
                      >
                        {formatSwapSymbol(p)}
                      </span>

                      <span className="shrink-0 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-success">
                        {t("trade.marketLinear")}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-text-muted">
                        {p.leverage}
                      </span>

                      <span
                        className={cn(
                          "text-right font-mono text-[10px] tabular-nums",
                          tick
                            ? up
                              ? "text-success"
                              : "text-danger"
                            : "text-text-muted",
                        )}
                      >
                        {tick ? (
                          <>
                            {up ? "+" : ""}
                            {tick.changePct.toFixed(2)}%
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}

            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-text-muted">
                {tab === "favorites" && favorites.length === 0
                  ? t("trade.noFavorites")
                  : t("trade.noMatchingPairs")}
              </li>
            ) : null}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
