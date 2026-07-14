"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { useDailySummary } from "@/lib/trade/store";
import {
  COUNTDOWN_PLACEHOLDER,
  formatCountdown,
} from "@/lib/utils";
import { useUtcMidnightCountdown } from "@/lib/hooks/use-utc-midnight-countdown";
import { useI18n } from "@/lib/i18n/context";

export function DailyAttempts() {
  const { t } = useI18n();
  const summary = useDailySummary();
  const countdown = useUtcMidnightCountdown();

  const pct =
    summary.maxAttempts > 0
      ? (summary.attemptsUsed / summary.maxAttempts) * 100
      : 0;

  return (
    <div className="surface-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("trade.dailyAttempts")}
          </h3>
          <Info className="h-3.5 w-3.5 text-text-muted" aria-hidden />
        </div>
        <span className="font-mono text-xs text-text-muted">
          {t("trade.resetsIn")}{" "}
          {countdown !== null
            ? formatCountdown(countdown)
            : COUNTDOWN_PLACEHOLDER}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <Ring
          percent={pct}
          big={`${summary.attemptsUsed}/${summary.maxAttempts}`}
          small={`${summary.attemptsRemaining} ${t("trade.leftCount")}`}
        />
        <ul className="space-y-1.5 text-xs">
          <li className="flex justify-between gap-6">
            <span className="text-text-secondary">{t("trade.wins")}</span>
            <span className="font-mono text-success">{summary.wins}</span>
          </li>
          <li className="flex justify-between gap-6">
            <span className="text-text-secondary">{t("trade.losses")}</span>
            <span className="font-mono text-danger">{summary.losses}</span>
          </li>
          <li className="flex justify-between gap-6">
            <span className="text-text-secondary">{t("trade.base")}</span>
            <span className="font-mono text-text-primary">
              {(summary.baseRateBps / 100).toFixed(2)}%
            </span>
          </li>
          <li className="flex justify-between gap-6">
            <span className="text-text-secondary">{t("trade.bonus")}</span>
            <span className="font-mono text-gold">
              +{(summary.bonusRateBps / 100).toFixed(2)}%
            </span>
          </li>
          <li className="mt-1.5 flex justify-between gap-6 border-t border-border-subtle pt-1.5">
            <span className="font-medium text-text-primary">{t("trade.today")}</span>
            <span className="font-mono text-text-primary">
              {(summary.totalRateBps / 100).toFixed(2)}%
            </span>
          </li>
        </ul>
      </div>

      <div
        className="mt-4 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${Math.max(summary.maxAttempts, summary.attemptsUsed, 1)}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({
          length: Math.max(summary.maxAttempts, summary.attemptsUsed),
        }).map((_, i) => {
          const used = i < summary.attemptsUsed;
          const isWin = i < summary.wins;
          return (
            <div
              key={i}
              className={`h-1.5 rounded-full ${
                used
                  ? isWin
                    ? "bg-success"
                    : "bg-danger/70"
                  : "bg-bg-pressed"
              }`}
              title={t("trade.attempt", { n: i + 1 })}
            />
          );
        })}
      </div>
    </div>
  );
}

function Ring({
  percent,
  big,
  small,
}: {
  percent: number;
  big: string;
  small: string;
}) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const safePct = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, percent))
    : 0;
  const offset = circ - (safePct / 100) * circ;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="hsl(228 11% 16%)"
          strokeWidth="7"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="url(#daily-grad)"
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id="daily-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0C75E" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base text-text-primary">{big}</span>
        <span className="text-[10px] text-text-muted">{small}</span>
      </div>
    </div>
  );
}
