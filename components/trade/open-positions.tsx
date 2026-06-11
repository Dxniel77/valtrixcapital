"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, CircleCheck, CircleX } from "lucide-react";
import { useTradeStore, type Position } from "@/lib/trade/store";
import { deriveSimultaneousLimit } from "@/lib/trade/limits";
import { activeCapital, useStakingStore } from "@/lib/staking/store";
import { findPair } from "@/lib/market/pairs";
import { cn, formatNumber } from "@/lib/utils";
import { useClientNow } from "@/lib/hooks/use-client-now";
import { useI18n } from "@/lib/i18n/context";

interface OpenPositionsProps {
  currentPair: string;
  livePrice: number | null;
  prices?: Record<string, number | undefined>;
}

export function OpenPositions({
  currentPair,
  livePrice,
  prices,
}: OpenPositionsProps) {
  const { t } = useI18n();
  const positions = useTradeStore((s) => s.positions);
  const stakes = useStakingStore((s) => s.stakes);
  const capital = activeCapital(stakes);
  const open = React.useMemo(
    () => positions.filter((p) => p.status === "OPEN"),
    [positions],
  );
  const simultaneous = React.useMemo(
    () => deriveSimultaneousLimit(open, capital),
    [open, capital],
  );
  const resolvePosition = useTradeStore((s) => s.resolvePosition);
  const now = useClientNow(500);

  React.useEffect(() => {
    if (now === null) return;
    for (const p of open) {
      const dueAt = p.openedAt + p.durationSec * 1000;
      if (now >= dueAt) {
        const price =
          p.pair === currentPair
            ? livePrice ?? prices?.[p.pair]
            : prices?.[p.pair];
        if (typeof price === "number" && price > 0) {
          resolvePosition(p.id, price);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, open.length, currentPair, livePrice]);

  if (open.length === 0) {
    return (
      <div className="surface-card flex items-center justify-center p-6 text-sm text-text-muted">
        {t("trade.noOpenPositions")}
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("trade.openPositions")}
        </h3>
        <span className="text-xs text-text-muted">
          {t("trade.simultaneousOpenCount", {
            open: simultaneous.open,
            max: simultaneous.max,
          })}
        </span>
      </header>
      <ul className="divide-y divide-border-subtle">
        {open.map((p) => (
          <OpenPositionRow
            key={p.id}
            position={p}
            now={now}
            livePrice={p.pair === currentPair ? livePrice : prices?.[p.pair] ?? null}
          />
        ))}
      </ul>
    </div>
  );
}

function OpenPositionRow({
  position,
  now,
  livePrice,
}: {
  position: Position;
  now: number | null;
  livePrice: number | null;
}) {
  const { t } = useI18n();
  const pair = findPair(position.pair);
  const dueAt = position.openedAt + position.durationSec * 1000;
  const remainingMs =
    now !== null ? Math.max(0, dueAt - now) : position.durationSec * 1000;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const elapsedPct = Math.min(
    100,
    (1 - remainingMs / (position.durationSec * 1000)) * 100,
  );
  const timerLabel =
    now !== null
      ? `${String(Math.floor(remainingSec / 60)).padStart(2, "0")}:${String(remainingSec % 60).padStart(2, "0")}`
      : "--:--";

  const direction = position.direction;
  const isUp = direction === "UP";

  const currentlyWinning =
    livePrice !== null
      ? isUp
        ? livePrice > position.entryPrice
        : livePrice < position.entryPrice
      : null;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-xs",
              isUp
                ? "bg-success/15 text-success"
                : "bg-danger/15 text-danger",
            )}
          >
            {isUp ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </span>
          <div className="text-xs">
            <p className="font-mono text-text-primary">
              {pair?.base ?? position.pair}/{pair?.quote ?? "USDT"}
            </p>
            <p className="text-text-muted">
              {t("dashboard.pages.history.entry")}{" "}
              <span className="font-mono text-text-secondary">
                {formatNumber(position.entryPrice, {
                  decimals: pair?.pricePrecision ?? 2,
                })}
              </span>
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <p className="text-text-muted">{t("trade.now")}</p>
          <p
            className={cn(
              "font-mono",
              currentlyWinning === null
                ? "text-text-secondary"
                : currentlyWinning
                  ? "text-success"
                  : "text-danger",
            )}
          >
            {livePrice
              ? formatNumber(livePrice, { decimals: pair?.pricePrecision ?? 2 })
              : "—"}
          </p>
        </div>

        <div className="w-28 text-right">
          <p className="font-mono text-sm text-text-primary">{timerLabel}</p>
          <p className="text-[10px] text-text-muted">
            {position.durationSec / 60}m
          </p>
        </div>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-pressed">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            currentlyWinning === null
              ? "bg-gold/60"
              : currentlyWinning
                ? "bg-success/80"
                : "bg-danger/80",
          )}
          style={{ width: `${elapsedPct}%` }}
        />
      </div>
    </li>
  );
}

export function ResolvedBadge({ status }: { status: "WIN" | "LOSS" }) {
  const { t } = useI18n();
  if (status === "WIN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-0.5 text-xs text-success">
        <CircleCheck className="h-3 w-3" /> {t("common.win")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-danger/10 px-1.5 py-0.5 text-xs text-danger">
      <CircleX className="h-3 w-3" /> {t("common.loss")}
    </span>
  );
}
