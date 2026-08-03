"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  ExternalLink,
  Gift,
  Wallet as WalletIcon,
} from "lucide-react";
import { useAccount } from "wagmi";
import { bsc, polygon } from "wagmi/chains";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartStakingCTA } from "@/components/staking/start-staking-cta";
import { WithdrawModal } from "@/components/wallet/withdraw-modal";
import {
  ClaimDepositForm,
  PendingDepositBanner,
} from "@/components/wallet/claim-deposit-form";
import { useI18n } from "@/lib/i18n/context";
import { CHAIN_META } from "@/lib/wagmi";
import {
  usePortfolioSummary,
  useStakingStore,
  useStakingStoreHydrated,
} from "@/lib/staking/store";
import { usePlatformSettings } from "@/lib/platform/settings-store";
import {
  WITHDRAWAL_FLOW,
  useWalletStore,
  type Withdrawal,
} from "@/lib/wallet/store";
import {
  isWithdrawalPending,
  resolveWithdrawalUiStatus,
} from "@/lib/wallet/withdrawal-display";
import { useReferralsStore } from "@/lib/referrals/store";
import { useLedger } from "@/lib/ledger";
import { cn, explorerUrl, formatNumber, shortenAddress, shortenHash } from "@/lib/utils";
import { useWithdrawalEligibility } from "@/lib/hooks/use-admin-user-sync";
import { SponsoredUnlockProgressCard } from "@/components/wallet/sponsored-unlock-progress-card";
import { Lock } from "lucide-react";

export default function WalletPage() {
  const { t } = useI18n();
  const hydrated = useStakingStoreHydrated();
  const summary = usePortfolioSummary();
  const earningsBalance = useStakingStore((s) => s.earningsBalance);
  const { minWithdrawalUsdt } = usePlatformSettings();
  const pendingNetwork = useReferralsStore((s) => s.pendingNetworkEarnings);
  const withdrawals = useWalletStore((s) => s.withdrawals);
  const { eligible, messageKey, adminUser, partialAllowance } =
    useWithdrawalEligibility();
  const withdrawableCap =
    adminUser?.accountGranted &&
    !adminUser.withdrawalUnlocked &&
    (partialAllowance ?? adminUser.withdrawalAllowance ?? 0) > 0
      ? Math.min(
          earningsBalance,
          partialAllowance ?? adminUser.withdrawalAllowance ?? 0,
        )
      : earningsBalance;
  const canWithdrawAmount = hydrated && withdrawableCap >= minWithdrawalUsdt;

  const [withdrawOpen, setWithdrawOpen] = React.useState(false);

  const pending = withdrawals.filter(isWithdrawalPending);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("walletPage.title")}
        subtitle={t("walletPage.subtitle")}
        actions={
          <>
            <StartStakingCTA
              variant="outline"
              size="md"
              add
              label={t("walletPage.deposit.addCapital")}
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => setWithdrawOpen(true)}
              disabled={!canWithdrawAmount || !eligible}
              title={
                !eligible
                  ? t(messageKey)
                  : !canWithdrawAmount
                    ? t("walletPage.withdraw.minError", {
                        min: formatNumber(minWithdrawalUsdt, { decimals: 0 }),
                      })
                    : undefined
              }
            >
              {!eligible ? (
                <Lock className="h-4 w-4" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}{" "}
              {t("walletPage.withdrawCta")}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("walletPage.availableBalance")}
          value={`$${formatNumber(hydrated ? withdrawableCap : 0, { decimals: 2 })}`}
          icon={WalletIcon}
          accent="gold"
          hint={
            adminUser?.accountGranted &&
            !adminUser.withdrawalUnlocked &&
            (partialAllowance ?? adminUser.withdrawalAllowance ?? 0) > 0
              ? t("walletPage.withdraw.eligibilityPartial")
              : t("walletPage.availableHint")
          }
        />
        <StatTile
          label={t("walletPage.pendingNetwork")}
          value={`$${formatNumber(hydrated ? pendingNetwork : 0, { decimals: 2 })}`}
          icon={Clock}
          accent="info"
          hint={t("walletPage.pendingNetworkHint")}
        />
        <StatTile
          label={t("walletPage.totalEarned")}
          value={`$${formatNumber(hydrated ? summary.totalEarned : 0, { decimals: 2 })}`}
          icon={ArrowDownToLine}
          accent="success"
          hint={t("walletPage.totalEarnedHint")}
        />
        <StatTile
          label={t("walletPage.activeCapital")}
          value={`$${formatNumber(hydrated ? summary.totalCapital : 0, { decimals: 2 })}`}
          icon={ArrowUpFromLine}
          accent="silver"
          hint={t("walletPage.activeCapitalHint")}
        />
      </div>

      <PendingDepositBanner />

      {adminUser?.accountGranted ? (
        <SponsoredUnlockProgressCard user={adminUser} />
      ) : null}

      {pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((w) => (
            <WithdrawalTracker key={w.id} w={w} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <AddCapitalCard />
        <RecentTransactionsCard />
      </div>

      <ClaimDepositForm />

      <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </div>
  );
}

function AddCapitalCard() {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();

  return (
    <Card id="add-funds">
      <CardHeader>
        <CardTitle>{t("walletPage.deposit.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-text-secondary">
          {t("walletPage.deposit.description")}
        </p>

        {isConnected && address ? (
          <div className="flex items-center gap-2.5 rounded-md border border-gold/30 bg-gold/5 px-3 py-2.5">
            <WalletIcon className="h-4 w-4 shrink-0 text-gold" />
            <p className="text-sm text-text-secondary">
              {t("walletPage.deposit.walletConnected", {
                address: shortenAddress(address),
              })}
            </p>
          </div>
        ) : (
          <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-warning">
            {t("walletPage.deposit.walletDisconnected")}
          </p>
        )}

        <ul className="space-y-2 text-xs text-text-muted">
          <li>{t("walletPage.deposit.stepAmount")}</li>
          <li>{t("walletPage.deposit.stepNetwork")}</li>
          <li>{t("walletPage.deposit.stepConfirm")}</li>
        </ul>

        <StartStakingCTA
          className="w-full"
          size="md"
          add
          label={t("walletPage.deposit.addCapital")}
        />
      </CardContent>
    </Card>
  );
}

function WithdrawalTracker({ w }: { w: Withdrawal }) {
  const { t } = useI18n();
  const meta = CHAIN_META[w.network === "POLYGON" ? polygon.id : bsc.id];
  const uiStatus = resolveWithdrawalUiStatus(w);
  const currentIdx = WITHDRAWAL_FLOW.indexOf(uiStatus);

  return (
    <Card className="border-gold/30">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="gold">
              <ArrowUpFromLine className="h-3 w-3" />
              {t("walletPage.tracker.title")}
            </Badge>
            <span className="font-mono text-sm text-text-primary">
              ${formatNumber(w.netAmount, { decimals: 2 })}
            </span>
            <span className="text-xs text-text-muted">
              {t("walletPage.tracker.toAddress", {
                address: shortenAddress(w.destination),
                network: meta.short,
              })}
            </span>
          </div>
          {w.txHash ? (
            <a
              href={explorerUrl(w.network, w.txHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-gold hover:text-gold-bright"
            >
              {shortenHash(w.txHash)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        <ol className="grid grid-cols-4 gap-1">
          {WITHDRAWAL_FLOW.map((status, i) => {
            const done =
              i < currentIdx ||
              (uiStatus === "COMPLETED" && status === "COMPLETED");
            const active = i === currentIdx;
            return (
              <li key={status} className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-colors",
                    done
                      ? "bg-success"
                      : active
                        ? "bg-gold animate-pulse-soft"
                        : "bg-bg-hover",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider",
                    done
                      ? "text-success"
                      : active
                        ? "text-gold"
                        : "text-text-muted",
                  )}
                >
                  {t(`walletPage.status.${status}`)}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

const CATEGORY_META: Record<
  string,
  { icon: React.ElementType; sign: "+" | "-" | ""; tone: string }
> = {
  DEPOSIT: { icon: ArrowDownToLine, sign: "+", tone: "text-info" },
  WITHDRAWAL: { icon: ArrowUpFromLine, sign: "-", tone: "text-danger" },
  YIELD: { icon: ArrowDownToLine, sign: "+", tone: "text-success" },
  COMMISSION: { icon: ArrowDownToLine, sign: "+", tone: "text-success" },
  ADJUSTMENT: { icon: Gift, sign: "", tone: "text-success" },
  TRADE: { icon: ArrowDownToLine, sign: "", tone: "text-text-muted" },
};

function RecentTransactionsCard() {
  const { t } = useI18n();
  const ledger = useLedger();
  const recent = ledger.filter((e) => e.category !== "TRADE").slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("walletPage.recent.title")}</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/history">{t("walletPage.recent.viewAll")}</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center">
            <p className="text-sm text-text-secondary">
              {t("walletPage.recent.empty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {recent.map((e) => {
              const m = CATEGORY_META[e.category] ?? CATEGORY_META.YIELD;
              const Icon = m.icon;
              const isCredit = e.amount >= 0;
              const sign =
                e.category === "ADJUSTMENT"
                  ? isCredit
                    ? "+"
                    : "-"
                  : m.sign;
              const tone =
                e.category === "ADJUSTMENT"
                  ? isCredit
                    ? "text-success"
                    : "text-danger"
                  : m.tone;
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-base",
                      tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary">
                      {t(`walletPage.category.${e.category}`)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(e.timestamp).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}
                      {e.category === "WITHDRAWAL"
                        ? ` · ${t(`walletPage.status.${resolveWithdrawalUiStatus({ status: e.status ?? "REQUESTED", txHash: e.txHash })}`)}`
                        : e.status
                          ? ` · ${t(`walletPage.status.${e.status}`)}`
                          : ""}
                      {e.note?.trim() ? ` · ${e.note.trim()}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 font-mono", tone)}>
                    {sign}${formatNumber(Math.abs(e.amount), { decimals: 2 })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
