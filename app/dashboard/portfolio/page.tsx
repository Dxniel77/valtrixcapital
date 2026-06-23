"use client";

import * as React from "react";
import {
  Activity,
  Coins,
  ExternalLink,
  Layers,
  Lock,
  TrendingUp,
  Unlock,
  Wallet as WalletIcon,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartStakingCTA } from "@/components/staking/start-staking-cta";
import { useI18n } from "@/lib/i18n/context";
import {
  PAYOUT_CAP_MULTIPLIER,
  useStakingStore,
  useStakingStoreHydrated,
  useTodayYieldPreview,
  usePortfolioSummary,
  type DailyYield,
} from "@/lib/staking/store";
import {
  cn,
  explorerUrl,
  formatNumber,
  shortenHash,
} from "@/lib/utils";

export default function PortfolioPage() {
  const { t } = useI18n();
  const hydrated = useStakingStoreHydrated();
  const stakes = useStakingStore((s) => s.stakes);
  const dailyYields = useStakingStore((s) => s.dailyYields);
  const summary = usePortfolioSummary();
  const preview = useTodayYieldPreview();

  const hasCapital = hydrated && stakes.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("staking.portfolio.title")}
        subtitle={t("staking.portfolio.subtitle")}
        actions={
          hasCapital ? (
            <StartStakingCTA
              variant="primary"
              size="md"
              add
              label={t("staking.portfolio.addCapital")}
            />
          ) : null
        }
      />

      {!hydrated ? (
        <SkeletonState />
      ) : !hasCapital ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={t("staking.portfolio.activeCapital")}
              value={`$${formatNumber(summary.totalCapital, { decimals: 2 })}`}
              icon={Coins}
              accent="gold"
              hint={t("staking.portfolio.activeStakes", {
                n: summary.activeStakes,
              })}
            />
            <StatTile
              label={t("staking.portfolio.totalEarned")}
              value={`$${formatNumber(summary.totalEarned, { decimals: 2 })}`}
              icon={TrendingUp}
              accent="success"
              delta={
                summary.totalCapital > 0
                  ? {
                      value:
                        (summary.totalEarned / summary.totalCapital) * 100,
                    }
                  : undefined
              }
              hint={t("staking.portfolio.earningsHint")}
            />
            <StatTile
              label={t("staking.portfolio.progressCap")}
              value={`${formatNumber(summary.capProgressPct, { decimals: 1 })}%`}
              icon={summary.isCapReached ? Unlock : Lock}
              accent="silver"
              hint={t("staking.portfolio.capRemaining", {
                amount: formatNumber(summary.remainingToCap, { decimals: 0 }),
              })}
            />
            <StatTile
              label={t("staking.portfolio.daysActive")}
              value={String(summary.daysActive)}
              icon={Activity}
              accent="info"
              hint={t("staking.portfolio.todayPreviewHint")}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <PayoutCapCard summary={summary} preview={preview} />
            <TodayPreviewCard preview={preview} />
          </div>

          <DailyYieldsCard yields={dailyYields} />

          <StakesCard />
        </>
      )}
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-lg border border-border-subtle bg-bg-elevated"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-bg-elevated p-8 shadow-card md:p-12">
      <div className="absolute inset-0 -z-10 bg-hero-radial opacity-40" />
      <div className="absolute inset-0 -z-10 grid-bg opacity-30" />
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          {t("staking.portfolio.emptyTitle")}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary md:text-base">
          {t("staking.portfolio.emptyDesc")}
        </p>
        <div className="mt-6 flex flex-col gap-4">
          <StartStakingCTA size="lg" className="self-start" />
          <Link
            href="/dashboard/trade"
            className="block max-w-xl whitespace-pre-line text-sm leading-relaxed text-text-secondary underline-offset-4 hover:text-gold hover:underline"
          >
            {t("staking.portfolio.emptyOrTrade")}
          </Link>
        </div>
        <ul className="mt-8 grid gap-2 sm:grid-cols-3">
          <EmptyBullet
            icon={Coins}
            title={t("staking.portfolio.emptyBullets.minTitle")}
            desc={t("staking.portfolio.emptyBullets.minDesc")}
          />
          <EmptyBullet
            icon={TrendingUp}
            title={t("staking.portfolio.emptyBullets.yieldTitle")}
            desc={t("staking.portfolio.emptyBullets.yieldDesc")}
          />
          <EmptyBullet
            icon={Lock}
            title={t("staking.portfolio.emptyBullets.lockTitle")}
            desc={t("staking.portfolio.emptyBullets.lockDesc")}
          />
        </ul>
      </div>
    </div>
  );
}

function EmptyBullet({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Coins;
  title: string;
  desc: string;
}) {
  return (
    <li className="rounded-md border border-border-subtle bg-bg-base/60 p-3">
      <div className="mb-1 inline-flex items-center gap-1.5 text-gold">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="text-xs text-text-secondary">{desc}</p>
    </li>
  );
}

function PayoutCapCard({
  summary,
  preview,
}: {
  summary: ReturnType<typeof usePortfolioSummary>;
  preview: ReturnType<typeof useTodayYieldPreview>;
}) {
  const { t } = useI18n();
  const pct = summary.capProgressBarPct;
  const roiPct = summary.capProgressPct;
  const totalEarnedDisplay = formatNumber(summary.totalEarned, { decimals: 2 });
  const capDisplay = formatNumber(summary.payoutCap, { decimals: 0 });
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("staking.portfolio.yieldProgress")}</CardTitle>
          {summary.isCapReached ? (
            <Badge variant="success">
              <Unlock className="h-3 w-3" />
              {t("staking.portfolio.unlockedBadge")}
            </Badge>
          ) : (
            <Badge variant="gold">
              <Lock className="h-3 w-3" />
              {t("staking.portfolio.lockedBadge", {
                pct: formatNumber(PAYOUT_CAP_MULTIPLIER * 100, { decimals: 0 }),
              })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted">
                {t("staking.portfolio.cumulativeEarned")}
              </p>
              <p className="font-mono text-2xl text-text-primary">
                ${totalEarnedDisplay}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-text-muted">
                {t("staking.portfolio.payoutCap")}
              </p>
              <p className="font-mono text-lg text-text-secondary">
                ${capDisplay}
              </p>
            </div>
          </div>
          <ProgressBar pct={pct} />
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>{formatNumber(roiPct, { decimals: 1 })}%</span>
            <span>
              {t("staking.portfolio.capRemainingShort", {
                amount: formatNumber(summary.remainingToCap, { decimals: 2 }),
              })}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <MiniStat
            label={t("staking.portfolio.earningsPassive")}
            value={`$${formatNumber(
              summary.passiveEarned + summary.passiveProjectedToday,
              { decimals: 2 },
            )}`}
          />
          <MiniStat
            label={t("staking.portfolio.earningsOps")}
            value={`$${formatNumber(
              summary.operationalEarned + summary.operationalPendingToday,
              { decimals: 2 },
            )}`}
            accent="gold"
          />
          <MiniStat
            label={t("staking.portfolio.earningsNetwork")}
            value={`$${formatNumber(summary.networkEarned, { decimals: 2 })}`}
            accent="success"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <MiniStat
            label={t("staking.portfolio.earningsWithdrawn")}
            value={`$${formatNumber(summary.totalWithdrawn, { decimals: 2 })}`}
          />
          <MiniStat
            label={t("staking.portfolio.earningsAvailable")}
            value={`$${formatNumber(summary.earningsBalance, { decimals: 2 })}`}
            accent="success"
          />
        </div>

        <p className="text-xs text-text-muted">
          {t("staking.portfolio.payoutNote")}
        </p>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const safe = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-bg-base">
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />
      <div
        className="relative h-full rounded-full bg-gradient-to-r from-gold via-gold-bright to-gold transition-[width] duration-700"
        style={{
          width: `${safe}%`,
          boxShadow: "0 0 24px rgba(212,175,55,0.35)",
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-border-strong" />
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string;
  accent?: "default" | "gold" | "success";
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-base/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-base",
          accent === "gold"
            ? "text-gold"
            : accent === "success"
              ? "text-success"
              : "text-text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TodayPreviewCard({
  preview,
}: {
  preview: ReturnType<typeof useTodayYieldPreview>;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {t("staking.portfolio.todayTitle")}
          </CardTitle>
          <Badge variant="info">{t("staking.portfolio.todayBadge")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-muted">
            {t("staking.portfolio.todayProjected")}
          </p>
          <p className="font-mono text-2xl text-text-primary">
            ${formatNumber(preview.projectedAmount, { decimals: 2 })}
          </p>
          <p className="text-xs text-text-muted">
            {t("staking.portfolio.todayOnCapital", {
              capital: formatNumber(preview.capital, { decimals: 0 }),
            })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-border-subtle bg-bg-base/60 p-2.5">
            <p className="text-text-muted">{t("staking.portfolio.wins")}</p>
            <p className="font-mono text-success">{preview.wins}/7</p>
          </div>
          <div className="rounded-md border border-border-subtle bg-bg-base/60 p-2.5">
            <p className="text-text-muted">{t("staking.portfolio.todayRate")}</p>
            <p className="font-mono text-gold">
              {(preview.totalRateBps / 100).toFixed(2)}%
            </p>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {t("staking.portfolio.todayCreditNote")}
        </p>
      </CardContent>
    </Card>
  );
}

function DailyYieldsCard({ yields }: { yields: DailyYield[] }) {
  const { t } = useI18n();
  const last14 = React.useMemo(() => yields.slice(0, 14), [yields]);
  const chartData = React.useMemo(() => last14.slice().reverse(), [last14]);
  const maxRate = 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("staking.portfolio.yieldsTitle")}</CardTitle>
          <Badge variant="default">
            {t("staking.portfolio.yieldsBadge", { n: yields.length })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {chartData.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center">
            <p className="text-sm text-text-secondary">
              {t("staking.portfolio.yieldsEmpty")}
            </p>
          </div>
        ) : (
          <YieldBarChart data={chartData} maxRate={maxRate} />
        )}
        {last14.length > 0 ? (
          <YieldTable yields={last14} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function YieldBarChart({
  data,
  maxRate,
}: {
  data: DailyYield[];
  maxRate: number;
}) {
  const chartHeight = 156;
  const cols = Math.max(data.length, 7);
  return (
    <div
      className="grid items-end gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        height: chartHeight + 36,
      }}
    >
      {data.map((y) => {
        const pct = Math.max(0.05, y.totalRateBps / maxRate);
        const barH = pct * chartHeight;
        const label = y.date.slice(5); // MM-DD
        return (
          <div
            key={y.id}
            className="flex flex-col items-center justify-end gap-2"
            title={`${y.date} · ${(y.totalRateBps / 100).toFixed(2)}%`}
          >
            <div
              className="relative w-full"
              style={{ height: chartHeight }}
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-md bg-gradient-to-t from-gold/20 to-gold transition-[height] duration-500"
                style={{ height: barH }}
              />
              <span
                className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] text-text-secondary"
                style={{ bottom: barH + 4 }}
              >
                {(y.totalRateBps / 100).toFixed(2)}%
              </span>
            </div>
            <span className="font-mono text-[10px] text-text-muted">
              {label}
            </span>
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, cols - data.length) }).map((_, i) => (
        <div key={`pad-${i}`} className="opacity-0" />
      ))}
    </div>
  );
}

function YieldTable({ yields }: { yields: DailyYield[] }) {
  const { t } = useI18n();
  return (
    <div className="overflow-hidden rounded-md border border-border-subtle">
      <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr] gap-2 border-b border-border-subtle bg-bg-base/40 px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted sm:grid">
        <span>{t("staking.portfolio.yieldDate")}</span>
        <span className="text-right">{t("staking.portfolio.yieldCapital")}</span>
        <span className="text-center">{t("staking.portfolio.yieldWins")}</span>
        <span className="text-right">{t("staking.portfolio.yieldRate")}</span>
        <span className="text-right">
          {t("staking.portfolio.yieldCredited")}
        </span>
      </div>
      <ul className="divide-y divide-border-subtle">
        {yields.map((y) => (
          <li
            key={y.id}
            className="grid grid-cols-2 gap-2 px-3 py-2 text-xs sm:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1fr]"
          >
            <span className="font-mono text-text-primary">{y.date}</span>
            <span className="font-mono text-text-secondary sm:text-right">
              ${formatNumber(y.capitalSnapshot, { decimals: 0 })}
            </span>
            <span className="font-mono text-text-secondary sm:text-center">
              <span className="text-success">{y.wins}</span>/
              <span className="text-text-muted">7</span>
            </span>
            <span className="font-mono text-gold sm:text-right">
              {(y.totalRateBps / 100).toFixed(2)}%
            </span>
            <span className="font-mono text-success sm:text-right">
              +${formatNumber(y.creditedAmount, { decimals: 2 })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StakesCard() {
  const { t } = useI18n();
  const stakes = useStakingStore((s) => s.stakes);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("staking.portfolio.stakesTitle")}</CardTitle>
          <Badge variant="default">
            <Layers className="h-3 w-3" />
            {t("staking.portfolio.stakesCount", { n: stakes.length })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {stakes.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {t("staking.portfolio.stakesEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {stakes.map((s) => {
              const date = new Date(s.confirmedAt ?? s.createdAt);
              const dateStr = date.toLocaleDateString("es-ES", {
                year: "numeric",
                month: "short",
                day: "2-digit",
              });
              return (
                <li
                  key={s.id}
                  className="grid grid-cols-2 items-center gap-2 py-3 text-sm sm:grid-cols-[1.2fr_1fr_0.7fr_0.8fr_1fr]"
                >
                  <span className="text-text-primary">{dateStr}</span>
                  <span className="font-mono text-text-primary sm:text-right">
                    ${formatNumber(s.amount, { decimals: 2 })}
                  </span>
                  <span className="hidden sm:block sm:text-center">
                    <NetworkChip network={s.network} />
                  </span>
                  <span className="hidden sm:block sm:text-right">
                    <StatusChip status={s.status} />
                  </span>
                  <a
                    href={explorerUrl(s.network, s.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 justify-self-end font-mono text-xs text-text-secondary hover:text-gold"
                  >
                    {shortenHash(s.txHash)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NetworkChip({ network }: { network: "BSC" | "POLYGON" }) {
  const meta =
    network === "BSC"
      ? { name: "BSC", color: "#F0B90B" }
      : { name: "Polygon", color: "#8247E5" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-base/60 px-2 py-0.5 text-[10px] text-text-secondary"
      style={{ borderColor: `${meta.color}40` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {meta.name}
    </span>
  );
}

function StatusChip({ status }: { status: "ACTIVE" | "COMPLETED" | "PENDING" | "FAILED" }) {
  const { t } = useI18n();
  if (status === "COMPLETED") {
    return (
      <Badge variant="silver">
        <Unlock className="h-3 w-3" />
        {t("staking.portfolio.stakeCompleted")}
      </Badge>
    );
  }
  if (status === "PENDING") {
    return (
      <Badge variant="warning">
        <WalletIcon className="h-3 w-3" />
        {t("staking.portfolio.stakePending")}
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge variant="danger">{t("staking.portfolio.stakeFailed")}</Badge>
    );
  }
  return (
    <Badge variant="success">
      <Lock className="h-3 w-3" />
      {t("staking.portfolio.stakeActive")}
    </Badge>
  );
}
