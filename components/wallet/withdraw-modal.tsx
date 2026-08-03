"use client";

import * as React from "react";
import { useAccount, useChainId } from "wagmi";
import { polygon } from "wagmi/chains";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Wallet } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { CHAIN_META } from "@/lib/wagmi";
import { useStakingStore, type StakingNetwork } from "@/lib/staking/store";
import { useWalletStore } from "@/lib/wallet/store";
import { usePlatformSettings } from "@/lib/platform/settings-store";
import { computeWithdrawal } from "@/lib/wallet/constants";
import { cn, formatNumber, shortenAddress } from "@/lib/utils";
import { bsc } from "wagmi/chains";
import { useWithdrawalEligibility } from "@/lib/hooks/use-admin-user-sync";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { allowOfflineSimulation } from "@/lib/runtime-mode";
import { createWithdrawalRequest, ApiError, fetchUserPortfolio } from "@/lib/api/client";
import { hydratePortfolioFromServer } from "@/lib/staking/hydrate-portfolio";
import type { PortfolioDto, WithdrawalDto } from "@/lib/staking/portfolio-types";
import { mapServerWithdrawal } from "@/lib/staking/portfolio-types";
import { useTreasuryLiquidity } from "@/lib/hooks/use-treasury-liquidity";
import { progressItemsForUser } from "@/lib/admin/withdrawal-progress";
import { WithdrawalVolumeProgress } from "@/components/admin/withdrawal-volume-progress";
import { Lock } from "lucide-react";

type Step = "form" | "success";

export function WithdrawModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const availableBalance = useStakingStore((s) => s.earningsBalance);
  const requestWithdrawal = useWalletStore((s) => s.requestWithdrawal);
  const backend = useBackendAvailable();
  const { eligible, messageKey, adminUser, partialAllowance } =
    useWithdrawalEligibility();
  const pool = useTreasuryLiquidity();
  const { minWithdrawalUsdt, withdrawalFeeBps } = usePlatformSettings();
  const withdrawalFeePct = withdrawalFeeBps / 100;

  const available =
    adminUser?.accountGranted &&
    !adminUser.withdrawalUnlocked &&
    (partialAllowance ?? adminUser.withdrawalAllowance ?? 0) > 0
      ? Math.min(
          availableBalance,
          partialAllowance ?? adminUser.withdrawalAllowance ?? 0,
        )
      : availableBalance;

  const [step, setStep] = React.useState<Step>("form");
  const [amountStr, setAmountStr] = React.useState("");
  const [network, setNetwork] = React.useState<StakingNetwork>(() =>
    chainId === polygon.id ? "POLYGON" : "BSC",
  );
  const [destination, setDestination] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setStep("form");
    setAmountStr("");
    setNetwork(chainId === polygon.id ? "POLYGON" : "BSC");
    setDestination(address ?? "");
  }, [open, chainId, address]);

  const amount = Number(amountStr.replace(/,/g, "."));
  const breakdown = computeWithdrawal(
    Number.isFinite(amount) ? amount : 0,
    withdrawalFeeBps,
  );
  const validAddress = /^0x[a-fA-F0-9]{40}$/.test(destination.trim());
  const amountValid =
    breakdown.amount >= minWithdrawalUsdt && breakdown.amount <= available;
  const canSubmit =
    isConnected && amountValid && validAddress && eligible;

  const [submitting, setSubmitting] = React.useState(false);

  function showTreasuryUnavailableToast() {
    toast.error(t("walletPage.withdraw.treasuryInsufficientTitle"), {
      description: t("walletPage.withdraw.treasuryInsufficient"),
    });
  }

  async function handleSubmit() {
    if (!eligible) {
      toast.error(t(messageKey));
      return;
    }
    if (!isConnected) {
      toast.error(t("walletPage.withdraw.connectFirst"));
      return;
    }
    if (breakdown.amount < minWithdrawalUsdt) {
      toast.error(
        t("walletPage.withdraw.minError", {
          min: formatNumber(minWithdrawalUsdt, { decimals: 0 }),
        }),
      );
      return;
    }
    if (breakdown.amount > available) {
      toast.error(t("walletPage.withdraw.insufficient"));
      return;
    }
    if (!validAddress) {
      toast.error(t("walletPage.withdraw.invalidAddress"));
      return;
    }

    const poolCoversPayout =
      pool.hasPoolLiquidity &&
      pool.canCoverPayout(network, breakdown.netAmount);
    if (!poolCoversPayout) {
      showTreasuryUnavailableToast();
      return;
    }

    setSubmitting(true);
    try {
      if (backend) {
        const res = await createWithdrawalRequest({
          amount: breakdown.amount,
          network,
          toAddress: destination.trim(),
        });
        const portfolioRes = await fetchUserPortfolio();
        if (portfolioRes.backend && portfolioRes.portfolio) {
          hydratePortfolioFromServer(portfolioRes.portfolio as PortfolioDto);
        } else if (res.withdrawal) {
          const mapped = mapServerWithdrawal(res.withdrawal as WithdrawalDto);
          useWalletStore.setState((s) => ({
            withdrawals: [
              mapped,
              ...s.withdrawals.filter((w) => w.id !== mapped.id),
            ],
          }));
          useStakingStore.setState((s) => ({
            earningsBalance: Math.max(0, s.earningsBalance - breakdown.amount),
          }));
        }
      } else if (allowOfflineSimulation()) {
        const res = requestWithdrawal({
          amount: breakdown.amount,
          network,
          destination: destination.trim(),
        });
        if ("error" in res) {
          if (res.error === "BELOW_MINIMUM") {
            toast.error(
              t("walletPage.withdraw.minError", {
                min: formatNumber(minWithdrawalUsdt, { decimals: 0 }),
              }),
            );
            return;
          }
          if (res.error === "INSUFFICIENT_TREASURY") {
            showTreasuryUnavailableToast();
            return;
          }
          toast.error(t("walletPage.withdraw.insufficient"));
          return;
        }
      } else {
        toast.error(t("errors.backendRequired"));
        return;
      }

      setStep("success");
      toast.success(t("walletPage.withdraw.submitted"));
    } catch (err) {
      if (err instanceof ApiError && err.payload.code === "PAYOUT_FAILED") {
        toast.error(t("walletPage.withdraw.payoutFailed"));
        return;
      }
      if (err instanceof ApiError && err.payload.code === "INSUFFICIENT_TREASURY") {
        showTreasuryUnavailableToast();
        return;
      }
      if (err instanceof ApiError && err.payload.code === "BELOW_MINIMUM") {
        toast.error(
          t("walletPage.withdraw.minError", {
            min: formatNumber(minWithdrawalUsdt, { decimals: 0 }),
          }),
        );
        return;
      }
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "form"
              ? t("walletPage.withdraw.title")
              : t("walletPage.withdraw.successTitle")}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? t("walletPage.withdraw.subtitle")
              : t("walletPage.withdraw.successSubtitle")}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <>
            <DialogBody className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-text-muted">
                    {t("walletPage.withdraw.amountLabel")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmountStr(String(available))}
                    className="text-xs text-gold hover:text-gold-bright"
                  >
                    {t("walletPage.withdraw.available", {
                      amount: formatNumber(available, { decimals: 2 }),
                    })}
                  </button>
                </div>
                <div
                  className={cn(
                    "flex h-14 items-center gap-2 rounded-md border bg-bg-base px-3",
                    amountValid || amountStr === ""
                      ? "border-border-subtle focus-within:border-gold"
                      : "border-danger/60",
                  )}
                >
                  <span className="text-xl font-mono text-text-muted">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-2xl font-mono text-text-primary outline-none placeholder:text-text-muted"
                  />
                  <span className="text-sm text-text-muted">USDT</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-text-muted">
                  {t("walletPage.withdraw.networkLabel")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["BSC", "POLYGON"] as StakingNetwork[]).map((n) => {
                    const meta = CHAIN_META[n === "POLYGON" ? polygon.id : bsc.id];
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
                          style={{ background: meta.color, opacity: 0.9 }}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "text-sm font-medium",
                            active ? "text-gold" : "text-text-primary",
                          )}
                        >
                          {meta.short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-text-muted">
                  {t("walletPage.withdraw.destinationLabel")}
                </label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="0x…"
                  className={cn(
                    "font-mono",
                    !validAddress && destination !== "" && "border-danger/60",
                  )}
                />
              </div>

              <div className="rounded-md border border-border-subtle bg-bg-base/60 p-3 text-xs">
                <div className="flex justify-between py-0.5 text-text-secondary">
                  <span>
                    {t("walletPage.withdraw.feeRow", {
                      pct: String(withdrawalFeePct),
                    })}
                  </span>
                  <span className="font-mono text-danger">
                    −${formatNumber(breakdown.fee, { decimals: 2 })}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between border-t border-border-subtle pt-1.5 text-text-primary">
                  <span className="font-medium">
                    {t("walletPage.withdraw.netRow")}
                  </span>
                  <span className="font-mono text-success">
                    ${formatNumber(breakdown.netAmount, { decimals: 2 })}
                  </span>
                </div>
              </div>

              {!isConnected ? (
                <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
                  <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{t("walletPage.withdraw.connectFirst")}</span>
                </div>
              ) : null}

              {isConnected && !eligible && adminUser?.accountGranted ? (
                <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium">{t("walletPage.withdraw.eligibilityHeading")}</p>
                    <p className="text-warning/90">{t(messageKey)}</p>
                    <WithdrawalVolumeProgress
                      items={progressItemsForUser(adminUser)}
                      unlocked={adminUser.withdrawalUnlocked}
                      compact
                      detailed
                    />
                  </div>
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button
                variant="ghost"
                size="md"
                onClick={() => onOpenChange(false)}
              >
                {t("walletPage.withdraw.cancel")}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit || submitting}
              >
                {t("walletPage.withdraw.submit")} <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="space-y-4 py-6">
              <div className="flex items-center justify-center">
                <div className="relative">
                  <span
                    className="absolute inset-0 -m-3 rounded-full bg-success/15 blur-md"
                    aria-hidden
                  />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-success/40 bg-success/10">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="font-display text-base font-semibold text-text-primary">
                  {t("walletPage.withdraw.successHeadline")}
                </p>
                <p className="text-sm text-text-secondary">
                  {t("walletPage.withdraw.successBody", {
                    amount: formatNumber(breakdown.netAmount, { decimals: 2 }),
                    address: shortenAddress(destination.trim()),
                  })}
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="primary"
                size="md"
                onClick={() => onOpenChange(false)}
              >
                {t("walletPage.withdraw.done")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
