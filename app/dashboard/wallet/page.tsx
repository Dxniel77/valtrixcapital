"use client";

import * as React from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Wallet as WalletIcon,
} from "lucide-react";
import { bsc, polygon } from "wagmi/chains";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartStakingCTA } from "@/components/staking/start-staking-cta";
import { WithdrawModal } from "@/components/wallet/withdraw-modal";
import { useI18n } from "@/lib/i18n/context";
import { CHAIN_META } from "@/lib/wagmi";
import {
  usePortfolioSummary,
  useStakingStore,
  useStakingStoreHydrated,
  useYieldEngine,
  type StakingNetwork,
} from "@/lib/staking/store";
import {
  WITHDRAWAL_FLOW,
  useWalletStore,
  useWithdrawalEngine,
  type Withdrawal,
  type WithdrawalStatus,
} from "@/lib/wallet/store";
import { DEPOSIT_ADDRESSES, USDT_CONTRACTS } from "@/lib/wallet/constants";
import { useLedger } from "@/lib/ledger";
import { cn, explorerUrl, formatNumber, shortenAddress, shortenHash } from "@/lib/utils";

export default function WalletPage() {
  const { t } = useI18n();
  const hydrated = useStakingStoreHydrated();
  const summary = usePortfolioSummary();
  const earningsBalance = useStakingStore((s) => s.earningsBalance);
  const withdrawals = useWalletStore((s) => s.withdrawals);

  useYieldEngine();
  useWithdrawalEngine();

  const [withdrawOpen, setWithdrawOpen] = React.useState(false);

  const pending = withdrawals.filter(
    (w) => w.status !== "COMPLETED" && w.status !== "REJECTED",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("walletPage.title")}
        subtitle={t("walletPage.subtitle")}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setWithdrawOpen(true)}
            disabled={!hydrated || earningsBalance <= 0}
          >
            <ArrowUpFromLine className="h-4 w-4" /> {t("walletPage.withdrawCta")}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatTile
          label={t("walletPage.availableBalance")}
          value={`$${formatNumber(hydrated ? earningsBalance : 0, { decimals: 2 })}`}
          icon={WalletIcon}
          accent="gold"
          hint={t("walletPage.availableHint")}
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
          accent="info"
          hint={t("walletPage.activeCapitalHint")}
        />
      </div>

      {pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((w) => (
            <WithdrawalTracker key={w.id} w={w} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <DepositCard />
        <RecentTransactionsCard />
      </div>

      <WithdrawModal open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </div>
  );
}

function DepositCard() {
  const { t } = useI18n();
  const [network, setNetwork] = React.useState<StakingNetwork>("BSC");
  const [copied, setCopied] = React.useState<string | null>(null);
  const address = DEPOSIT_ADDRESSES[network];
  const contract = USDT_CONTRACTS[network];
  const meta = CHAIN_META[network === "POLYGON" ? polygon.id : bsc.id];

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(t("walletPage.deposit.copied"));
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error(t("walletPage.deposit.copyFailed"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("walletPage.deposit.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["BSC", "POLYGON"] as StakingNetwork[]).map((n) => {
            const m = CHAIN_META[n === "POLYGON" ? polygon.id : bsc.id];
            const active = network === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border bg-bg-base/60 px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-gold/50 bg-gold/10"
                    : "border-border-subtle hover:border-border-strong",
                )}
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-full"
                  style={{ background: m.color, opacity: 0.9 }}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-gold" : "text-text-primary",
                  )}
                >
                  {m.short}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-xl border border-border-subtle bg-white p-3">
            <QRCodeSVG
              value={address}
              size={128}
              bgColor="#ffffff"
              fgColor="#0A0A0F"
              level="M"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-text-muted">
                {t("walletPage.deposit.addressLabel", { network: meta.short })}
              </label>
              <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-secondary">
                  {address}
                </span>
                <button
                  type="button"
                  onClick={() => copy(address, "addr")}
                  className="shrink-0 rounded p-1 text-text-muted hover:text-gold"
                  aria-label={t("walletPage.deposit.copy")}
                >
                  {copied === "addr" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-text-muted">
                {t("walletPage.deposit.contractLabel")}
              </label>
              <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                  {contract}
                </span>
                <button
                  type="button"
                  onClick={() => copy(contract, "contract")}
                  className="shrink-0 rounded p-1 text-text-muted hover:text-gold"
                  aria-label={t("walletPage.deposit.copy")}
                >
                  {copied === "contract" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("walletPage.deposit.warning", { network: meta.short })}</span>
        </div>

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
  const currentIdx = WITHDRAWAL_FLOW.indexOf(w.status);

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
            const done = i < currentIdx || w.status === "COMPLETED";
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
              const m = CATEGORY_META[e.category];
              const Icon = m.icon;
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-base",
                      m.tone,
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
                      {e.status ? ` · ${t(`walletPage.status.${e.status}`)}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 font-mono", m.tone)}>
                    {m.sign}${formatNumber(Math.abs(e.amount), { decimals: 2 })}
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
