"use client";

import * as React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Coins,
  LineChart,
  Lock,
  Sparkles,
  TrendingUp,
  Trophy,
  Unlock,
  Users,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartStakingCTA } from "@/components/staking/start-staking-cta";
import {
  COUNTDOWN_PLACEHOLDER,
  formatCountdown,
  formatNumber,
  shortenAddress,
} from "@/lib/utils";
import { useUtcMidnightCountdown } from "@/lib/hooks/use-utc-midnight-countdown";
import { MAX_TRADES_PER_DAY, useDailySummary } from "@/lib/trade/store";
import {
  PAYOUT_CAP_MULTIPLIER,
  usePortfolioSummary,
  useStakingStore,
  useStakingStoreHydrated,
  useTodayYieldPreview,
  type DailyYield,
} from "@/lib/staking/store";
import {
  useBotFeedEngine,
  useCompanyProfits,
} from "@/lib/bot/store";
import { useI18n } from "@/lib/i18n/context";

export default function DashboardOverviewPage() {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const countdown = useUtcMidnightCountdown();
  const summary = useDailySummary();
  const portfolio = usePortfolioSummary();
  const preview = useTodayYieldPreview();
  const hydrated = useStakingStoreHydrated();
  const yields = useStakingStore((s) => s.dailyYields);
  const companyProfits = useCompanyProfits();

  useBotFeedEngine();

  const hasCapital = hydrated && portfolio.totalCapital > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            {t("dashboard.overview.welcome")}
            {isConnected && address
              ? `, ${shortenAddress(address, 4, 4)}`
              : ""}
          </>
        }
        subtitle={t("dashboard.overview.subtitle")}
        actions={
          <>
            <Button asChild variant="outline" size="md">
              <Link href="/dashboard/portfolio">
                {t("dashboard.overview.viewPortfolio")}
              </Link>
            </Button>
            {hasCapital ? (
              <Button asChild variant="primary" size="md">
                <Link href="/dashboard/trade">
                  {t("dashboard.overview.startTrading")}{" "}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <StartStakingCTA size="md" />
            )}
          </>
        }
      />

      <CompanyProfitsStrip profits={companyProfits} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("dashboard.overview.activeCapital")}
          value={`$${formatNumber(portfolio.totalCapital, { decimals: 2 })}`}
          icon={Coins}
          accent="gold"
          hint={
            portfolio.activeStakes > 0
              ? t("dashboard.overview.stakesHintN", {
                  n: portfolio.activeStakes,
                })
              : t("dashboard.overview.stakesHintEmpty")
          }
          delta={
            portfolio.totalCapital > 0
              ? {
                  value:
                    (portfolio.totalEarned /
                      Math.max(portfolio.totalCapital, 1)) *
                    100,
                }
              : undefined
          }
        />
        <StatTile
          label={t("dashboard.overview.todayYield")}
          value={`${(preview.totalRateBps / 100).toFixed(2)}%`}
          delta={{ value: preview.bonusRateBps / 100 }}
          icon={Activity}
          accent="success"
          hint={
            hasCapital
              ? `$${formatNumber(preview.projectedAmount, { decimals: 2 })} ${t("dashboard.overview.projected")}`
              : `${(preview.totalRateBps / 100).toFixed(2)}% ${t("dashboard.overview.capHint")}`
          }
        />
        <StatTile
          label={t("dashboard.overview.winsToday")}
          value={`${summary.wins} / ${MAX_TRADES_PER_DAY}`}
          delta={{ value: summary.bonusRateBps / 100 }}
          icon={Trophy}
          accent="info"
          hint={t("dashboard.overview.resetIn", {
            time:
              countdown !== null
                ? formatCountdown(countdown)
                : COUNTDOWN_PLACEHOLDER,
          })}
        />
        <StatTile
          label={t("dashboard.overview.toCap")}
          value={`${formatNumber(portfolio.capProgressPct, { decimals: 0 })}%`}
          icon={portfolio.isCapReached ? Unlock : Lock}
          accent="silver"
          hint={
            hasCapital
              ? t("dashboard.overview.capRemaining", {
                  amount: formatNumber(portfolio.remainingToCap, {
                    decimals: 0,
                  }),
                })
              : t("dashboard.overview.capStakeFirst")
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.overview.yieldWeek")}</CardTitle>
              {yields.length > 0 ? (
                <Badge variant="success">
                  +${formatNumber(weekTotal(yields), { decimals: 2 })}{" "}
                  {t("dashboard.overview.last7d")}
                </Badge>
              ) : (
                <Badge variant="default">{t("dashboard.overview.noYieldYet")}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <YieldWeekChart yields={yields} preview={preview} />
            <p className="mt-3 text-xs text-text-muted">
              {t("dashboard.overview.yieldNote")}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!hydrated ? (
            <CapitalCalloutSkeleton />
          ) : !hasCapital ? (
            <CapitalCallout />
          ) : (
            <PayoutMiniCard portfolio={portfolio} />
          )}
          <DailyAttemptsCard
            remainingMs={countdown}
            wins={summary.wins}
            losses={summary.losses}
            total={MAX_TRADES_PER_DAY}
          />
          <QuickLinksCard />
        </div>
      </div>
    </div>
  );
}

function weekTotal(yields: DailyYield[]): number {
  return yields.slice(0, 7).reduce((acc, y) => acc + y.creditedAmount, 0);
}

function CompanyProfitsStrip({
  profits,
}: {
  profits: { today: number; week: number; allTime: number };
}) {
  const { t } = useI18n();
  const items = [
    { label: t("dashboard.overview.companyToday"), value: profits.today },
    { label: t("dashboard.overview.companyWeek"), value: profits.week },
    { label: t("dashboard.overview.companyAllTime"), value: profits.allTime },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-gold/30 bg-gradient-to-r from-gold/10 via-bg-elevated to-info/5">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gold/30 bg-gold/10 text-gold">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wider text-gold">
              {t("dashboard.overview.companyProfits")}
            </p>
            <p className="text-[11px] text-text-muted">
              {t("dashboard.overview.companyProfitsHint")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.label} className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                {it.label}
              </p>
              <p className="font-mono text-base text-text-primary sm:text-lg">
                ${formatNumber(it.value, { decimals: 0 })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapitalCalloutSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="h-5 w-32 animate-pulse rounded bg-bg-hover" />
        <div className="h-5 w-48 animate-pulse rounded bg-bg-hover" />
        <div className="h-4 w-full animate-pulse rounded bg-bg-hover" />
        <div className="h-10 w-full animate-pulse rounded bg-bg-hover" />
      </CardContent>
    </Card>
  );
}

function CapitalCallout() {
  const { t } = useI18n();
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <Badge variant="gold">
          <Sparkles className="h-3 w-3" />
          {t("dashboard.overview.startStakingBadge")}
        </Badge>
        <h3 className="font-display text-base font-semibold text-text-primary">
          {t("dashboard.overview.capitalCalloutTitle")}
        </h3>
        <p className="text-xs text-text-secondary">
          {t("dashboard.overview.capitalCalloutDesc")}
        </p>
        <StartStakingCTA className="w-full" size="md" />
      </CardContent>
    </Card>
  );
}

function PayoutMiniCard({
  portfolio,
}: {
  portfolio: ReturnType<typeof usePortfolioSummary>;
}) {
  const { t } = useI18n();
  const pct = portfolio.capProgressBarPct;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {t("dashboard.overview.payoutCapTitle")}
          </CardTitle>
          <Badge variant={portfolio.isCapReached ? "success" : "gold"}>
            {portfolio.isCapReached ? (
              <Unlock className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            {(PAYOUT_CAP_MULTIPLIER * 100).toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              {t("dashboard.overview.totalEarned")}
            </p>
            <p className="font-mono text-xl text-text-primary">
              ${formatNumber(portfolio.totalEarned, { decimals: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">
              {t("dashboard.overview.payoutCapLabel")}
            </p>
            <p className="font-mono text-sm text-text-secondary">
              ${formatNumber(portfolio.payoutCap, { decimals: 0 })}
            </p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-base">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold via-gold-bright to-gold transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-text-primary">
            {formatNumber(portfolio.capProgressPct, { decimals: 1 })}%
          </span>
          <Link
            href="/dashboard/portfolio"
            className="inline-flex items-center gap-1 text-text-secondary hover:text-gold"
          >
            {t("dashboard.overview.viewPortfolio")}{" "}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function YieldWeekChart({
  yields,
  preview,
}: {
  yields: DailyYield[];
  preview: ReturnType<typeof useTodayYieldPreview>;
}) {
  const { t } = useI18n();
  const recent = yields.slice(0, 7).slice().reverse();
  const today = preview.totalRateBps / 100;
  const data = [
    ...recent.map((y) => ({
      label: y.date.slice(5),
      rate: y.totalRateBps / 100,
      amount: y.creditedAmount,
      isToday: false,
    })),
    {
      label: t("dashboard.overview.todayChartLabel"),
      rate: today,
      amount: preview.projectedAmount,
      isToday: true,
    },
  ].slice(-7);
  const max = 1;
  const chartHeight = 176;
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${Math.max(data.length, 7)}, minmax(0, 1fr))`,
        height: chartHeight + 36,
      }}
    >
      {data.map((day, idx) => {
        const barH = (Math.min(day.rate, max) / max) * chartHeight;
        return (
          <div
            key={idx}
            className="flex flex-col items-center justify-end gap-2"
          >
            <div className="relative w-full" style={{ height: chartHeight }}>
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-[height] duration-500 ${
                  day.isToday
                    ? "bg-gradient-to-t from-info/20 to-info"
                    : "bg-gradient-to-t from-gold/20 to-gold/80"
                }`}
                style={{ height: Math.max(barH, 2) }}
              />
              <span
                className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] text-text-secondary"
                style={{ bottom: Math.max(barH, 2) + 4 }}
              >
                {day.rate.toFixed(2)}%
              </span>
            </div>
            <span
              className={`text-xs ${day.isToday ? "text-info" : "text-text-muted"}`}
            >
              {day.label}
            </span>
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, 7 - data.length) }).map((_, i) => (
        <div key={`pad-${i}`} className="opacity-0" />
      ))}
    </div>
  );
}

function DailyAttemptsCard({
  remainingMs,
  wins,
  losses,
  total,
}: {
  remainingMs: number | null;
  wins: number;
  losses: number;
  total: number;
}) {
  const { t } = useI18n();
  const used = wins + losses;
  const remaining = Math.max(total - used, 0);
  const pct = (used / total) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {t("dashboard.overview.dailyAttempts")}
          </CardTitle>
          <Badge variant="gold">
            {t("dashboard.overview.bonusBadge", {
              pct: (wins * 0.1).toFixed(1),
            })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <RingProgress percent={pct} value={`${used}/${total}`} />
          <div className="text-xs text-text-secondary">
            <p>
              <span className="font-mono text-success">{wins}</span>{" "}
              {t("dashboard.overview.wins")} ·{" "}
              <span className="font-mono text-danger">{losses}</span>{" "}
              {t("dashboard.overview.losses")}
            </p>
            <p className="mt-0.5">
              <span className="font-mono text-text-primary">{remaining}</span>{" "}
              {t("dashboard.overview.attemptsLeft")}
            </p>
            <p className="mt-2 text-text-muted">
              {t("dashboard.overview.resetsIn")}{" "}
              <span className="font-mono text-text-primary">
                {remainingMs !== null
                  ? formatCountdown(remainingMs)
                  : COUNTDOWN_PLACEHOLDER}
              </span>
            </p>
          </div>
        </div>
        <Button asChild variant="primary" size="md" className="w-full">
          <Link href="/dashboard/trade">
            {t("dashboard.overview.useNextAttempt")}{" "}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RingProgress({ percent, value }: { percent: number; value: string }) {
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="hsl(228 11% 16%)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="url(#gold-grad)"
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0C75E" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm text-text-primary">
        {value}
      </span>
    </div>
  );
}

function QuickLinksCard() {
  const { t } = useI18n();
  const links = [
    { href: "/dashboard/trade", icon: LineChart, label: t("dashboard.overview.quickTrade") },
    { href: "/dashboard/referrals", icon: Users, label: t("dashboard.overview.quickInvite") },
    { href: "/dashboard/bot-trading", icon: Bot, label: t("dashboard.overview.quickBot") },
    { href: "/dashboard/wallet", icon: Wallet, label: t("dashboard.overview.quickWallet") },
  ];
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-2 p-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base/60 p-3 text-sm text-text-secondary hover:border-gold/30 hover:text-text-primary"
          >
            <l.icon className="h-4 w-4 text-gold" />
            {l.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
