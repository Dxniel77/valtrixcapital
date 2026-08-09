"use client";

import * as React from "react";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lock,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useUsdtDeposit } from "@/lib/hooks/use-usdt-deposit";
import { allowOfflineSimulation } from "@/lib/runtime-mode";
import {
  advanceDepositOnServer,
  claimDepositByTxHash,
  registerDepositRequest,
} from "@/lib/api/client";
import { CHAIN_META } from "@/lib/wagmi";
import { getDepositAddress } from "@/lib/wallet/deposit-addresses";
import { usePlatformSettings } from "@/lib/platform/settings-store";
import {
  useStakingStore,
  type StakingNetwork,
} from "@/lib/staking/store";
import {
  cn,
  explorerUrl,
  formatNumber,
  shortenHash,
} from "@/lib/utils";
import { bsc, polygon } from "wagmi/chains";

type Step = "form" | "wallet" | "confirming" | "success";

const PRESETS = [50, 250, 1000, 5000];

interface StakeDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function targetChainIdFor(network: StakingNetwork): number {
  return network === "POLYGON" ? polygon.id : bsc.id;
}

export function StakeDepositModal({
  open,
  onOpenChange,
}: StakeDepositModalProps) {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const backend = useBackendAvailable();
  const { deposit: sendUsdtDeposit } = useUsdtDeposit();

  const [step, setStep] = React.useState<Step>("form");
  const [amountStr, setAmountStr] = React.useState<string>("250");
  const [network, setNetwork] = React.useState<StakingNetwork>(() =>
    chainId === polygon.id ? "POLYGON" : "BSC",
  );

  const beginDeposit = useStakingStore((s) => s.beginDeposit);
  const advance = useStakingStore((s) => s.advanceDepositConfirmation);
  const syncConfirmations = useStakingStore((s) => s.setPendingConfirmations);
  const finalize = useStakingStore((s) => s.finalizePendingDeposit);
  const cancel = useStakingStore((s) => s.cancelPendingDeposit);
  const pending = useStakingStore((s) => s.pendingDeposit);
  const { minStakeUsdt, maxStakeUsdt } = usePlatformSettings();

  React.useEffect(() => {
    if (chainId === polygon.id) setNetwork("POLYGON");
    else if (chainId === bsc.id) setNetwork("BSC");
  }, [chainId]);

  React.useEffect(() => {
    if (!open) return;
    setStep("form");
  }, [open]);

  const amount = Number(amountStr.replace(/,/g, "."));
  const amountValid =
    Number.isFinite(amount) &&
    amount >= minStakeUsdt &&
    amount <= maxStakeUsdt;
  const targetChainId = targetChainIdFor(network);
  const needsSwitch = isConnected && chainId !== targetChainId;

  const dailyMin = amountValid ? amount * 0.003 : 0;
  const dailyMax = amountValid ? amount * 0.01 : 0;

  async function handleContinue() {
    if (!isConnected || !address) {
      toast.error(t("staking.deposit.connectWalletFirst"));
      return;
    }
    if (!amountValid) {
      toast.error(
        amount < minStakeUsdt
          ? t("staking.deposit.amountTooLow")
          : t("staking.deposit.amountTooHigh"),
      );
      return;
    }

    if (needsSwitch && switchChainAsync) {
      try {
        await switchChainAsync({ chainId: targetChainId });
      } catch {
        toast.error(t("staking.deposit.switchFailed"));
        return;
      }
    }

    setStep("wallet");

    let submittedTxHash: string | null = null;

    try {
      if (allowOfflineSimulation() && !backend) {
        beginDeposit({ amount, network });
        window.setTimeout(() => setStep("confirming"), 1600);
        return;
      }

      const toAddress = getDepositAddress(network);
      if (!toAddress) {
        toast.error(t("staking.deposit.treasuryMissing"));
        setStep("form");
        return;
      }

      // 1) On-chain transfer — once this returns, USDT has left the wallet.
      submittedTxHash = await sendUsdtDeposit({
        network,
        amount,
        toAddress: toAddress as `0x${string}`,
      });

      if (!backend) {
        if (allowOfflineSimulation()) {
          beginDeposit({ amount, network, txHash: submittedTxHash });
          setStep("confirming");
          return;
        }
        toast.error(t("errors.backendRequired"));
        setStep("form");
        return;
      }

      // 2) Register in Valtrix. If this fails, money is already on-chain —
      // recover via claim so the user is not stuck with an uncredited transfer.
      let serverDepositId: string | undefined;
      try {
        const res = await registerDepositRequest({
          network,
          amount,
          fromAddress: address,
          toAddress,
          txHash: submittedTxHash,
        });
        serverDepositId = res.deposit.id;
      } catch {
        try {
          const claim = await claimDepositByTxHash({
            network,
            txHash: submittedTxHash,
          });
          const dep = claim.deposit as { id?: string } | undefined;
          serverDepositId = typeof dep?.id === "string" ? dep.id : undefined;
          toast.message(t("staking.deposit.recoveredAfterRegisterFail"));
        } catch {
          toast.warning(t("staking.deposit.sentNeedsClaim"), {
            description: t("staking.deposit.sentNeedsClaimHint"),
            duration: 12_000,
          });
        }
      }

      beginDeposit({
        amount,
        network,
        txHash: submittedTxHash,
        serverDepositId,
      });
      setStep("confirming");
    } catch (err) {
      // If the wallet tx already succeeded, never treat this as a failed transfer.
      if (submittedTxHash && backend) {
        beginDeposit({
          amount,
          network,
          txHash: submittedTxHash,
        });
        setStep("confirming");
        toast.warning(t("staking.deposit.sentNeedsClaim"), {
          description: t("staking.deposit.sentNeedsClaimHint"),
          duration: 12_000,
        });
        void claimDepositByTxHash({
          network,
          txHash: submittedTxHash,
        }).catch(() => undefined);
        return;
      }

      const message = err instanceof Error ? err.message : "";
      if (
        message === "WALLET_NOT_CONNECTED" ||
        message.includes("User rejected") ||
        message.includes("user rejected")
      ) {
        toast.error(t("staking.deposit.transferRejected"));
      } else {
        toast.error(t("staking.deposit.transferFailed"));
      }
      setStep("form");
    }
  }

  React.useEffect(() => {
    if (step !== "confirming") return;
    if (!pending) return;
    if (pending.confirmations >= pending.requiredConfirmations) return;
    const id = window.setInterval(() => {
      if (!backend) {
        advance();
      }
      const depositId = pending.serverDepositId ?? pending.id;
      if (backend && pending.txHash) {
        void claimDepositByTxHash({
          network: pending.network,
          txHash: pending.txHash,
        })
          .then((res) => {
            const dep = res.deposit as
              | { status?: string; confirmations?: number }
              | undefined;
            if (dep && typeof dep.confirmations === "number") {
              syncConfirmations(dep.confirmations);
            }
            if (dep?.status === "CONFIRMED") {
              cancel();
              setStep("success");
              toast.success(t("staking.deposit.toastConfirmed"));
            }
          })
          .catch(() => undefined);
      } else if (backend && depositId) {
        void advanceDepositOnServer(depositId).catch(() => undefined);
      }
    }, 450);
    return () => window.clearInterval(id);
  }, [step, pending, advance, backend, cancel, syncConfirmations, t]);

  React.useEffect(() => {
    if (step !== "confirming") return;
    if (!pending) return;
    if (pending.confirmations < pending.requiredConfirmations) return;

    async function complete() {
      if (backend && pending?.txHash) {
        try {
          const res = await claimDepositByTxHash({
            network: pending.network,
            txHash: pending.txHash,
          });
          if (
            res.deposit &&
            typeof res.deposit === "object" &&
            "status" in res.deposit &&
            (res.deposit as { status: string }).status === "CONFIRMED"
          ) {
            cancel();
            setStep("success");
            toast.success(t("staking.deposit.toastConfirmed"));
          }
          return;
        } catch {
          toast.error(t("staking.deposit.confirmingHint", { network: pending.network }));
          return;
        }
      }

      const depositId = pending?.serverDepositId ?? pending?.id;
      if (backend && depositId) {
        try {
          await advanceDepositOnServer(depositId);
        } catch {
          toast.error(t("errors.signInFailed"));
          return;
        }
      }

      if (!allowOfflineSimulation()) {
        toast.error(t("errors.backendRequired"));
        cancel();
        setStep("form");
        return;
      }

      const stake = finalize();
      if (stake) {
        setStep("success");
        toast.success(t("staking.deposit.toastConfirmed"));
      }
    }

    void complete();
  }, [step, pending, finalize, cancel, backend, t]);

  function handleClose(next: boolean) {
    if (!next) {
      if (step === "wallet" || step === "confirming") {
        cancel();
      }
      setStep("form");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showClose={step !== "wallet" && step !== "confirming"}>
        <DialogHeader>
          <DialogTitle>{stepTitle(step, t)}</DialogTitle>
          <DialogDescription>{stepSubtitle(step, t)}</DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <FormStep
            amountStr={amountStr}
            onAmountChange={setAmountStr}
            amount={amount}
            amountValid={amountValid}
            network={network}
            onNetworkChange={setNetwork}
            dailyMin={dailyMin}
            dailyMax={dailyMax}
            isConnected={isConnected}
            needsSwitch={needsSwitch}
            onContinue={handleContinue}
            onCancel={() => handleClose(false)}
          />
        ) : null}

        {step === "wallet" ? <WalletStep network={network} /> : null}

        {step === "confirming" && pending ? (
          <ConfirmingStep
            txHash={pending.txHash}
            network={pending.network}
            confirmations={pending.confirmations}
            required={pending.requiredConfirmations}
          />
        ) : null}

        {step === "success" ? (
          <SuccessStep onClose={() => handleClose(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function stepTitle(step: Step, t: (k: string) => string): string {
  switch (step) {
    case "form":
      return t("staking.deposit.title");
    case "wallet":
      return t("staking.deposit.walletTitle");
    case "confirming":
      return t("staking.deposit.confirmingTitle");
    case "success":
      return t("staking.deposit.successTitle");
  }
}

function stepSubtitle(step: Step, t: (k: string) => string): string {
  switch (step) {
    case "form":
      return t("staking.deposit.subtitle");
    case "wallet":
      return t("staking.deposit.walletSubtitle");
    case "confirming":
      return t("staking.deposit.confirmingSubtitle");
    case "success":
      return t("staking.deposit.successSubtitle");
  }
}

function FormStep({
  amountStr,
  onAmountChange,
  amount,
  amountValid,
  network,
  onNetworkChange,
  dailyMin,
  dailyMax,
  isConnected,
  needsSwitch,
  onContinue,
  onCancel,
}: {
  amountStr: string;
  onAmountChange: (v: string) => void;
  amount: number;
  amountValid: boolean;
  network: StakingNetwork;
  onNetworkChange: (n: StakingNetwork) => void;
  dailyMin: number;
  dailyMax: number;
  isConnected: boolean;
  needsSwitch: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const { minStakeUsdt, maxStakeUsdt } = usePlatformSettings();
  return (
    <>
      <DialogBody className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("staking.deposit.amountLabel")}
            </label>
            <span className="text-xs text-text-muted">
              {t("staking.deposit.range", {
                min: formatNumber(minStakeUsdt, { decimals: 0 }),
                max: formatNumber(maxStakeUsdt, { decimals: 0 }),
              })}
            </span>
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
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="250"
              className="w-full bg-transparent text-2xl font-mono text-text-primary outline-none placeholder:text-text-muted"
            />
            <span className="text-sm text-text-muted">USDT</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onAmountChange(String(p))}
                className={cn(
                  "rounded-md border border-border-subtle bg-bg-base/60 px-2.5 py-1 text-xs font-mono text-text-secondary transition-colors hover:border-gold/40 hover:text-text-primary",
                  amount === p && "border-gold/50 bg-gold/10 text-gold",
                )}
              >
                ${formatNumber(p, { decimals: 0 })}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onAmountChange(String(maxStakeUsdt))}
              className="rounded-md border border-border-subtle bg-bg-base/60 px-2.5 py-1 text-xs font-mono text-text-secondary transition-colors hover:border-gold/40 hover:text-text-primary"
            >
              {t("staking.deposit.maxBtn")}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-text-muted">
            {t("staking.deposit.networkLabel")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NetworkOption
              network="BSC"
              active={network === "BSC"}
              onSelect={() => onNetworkChange("BSC")}
            />
            <NetworkOption
              network="POLYGON"
              active={network === "POLYGON"}
              onSelect={() => onNetworkChange("POLYGON")}
            />
          </div>
        </div>

        <div className="rounded-md border border-border-subtle bg-bg-base/60 p-3 text-xs">
          <div className="mb-1.5 flex items-center gap-1.5 text-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            <span>{t("staking.deposit.projectionTitle")}</span>
          </div>
          <div className="flex justify-between py-0.5 text-text-secondary">
            <span>{t("staking.deposit.dailyMin")}</span>
            <span className="font-mono text-text-primary">
              ${formatNumber(dailyMin, { decimals: 2 })}
            </span>
          </div>
          <div className="flex justify-between py-0.5 text-text-secondary">
            <span>{t("staking.deposit.dailyMax")}</span>
            <span className="font-mono text-gold">
              ${formatNumber(dailyMax, { decimals: 2 })}
            </span>
          </div>
          <div className="mt-1.5 flex justify-between border-t border-border-subtle pt-1.5 text-text-primary">
            <span className="font-medium">{t("staking.deposit.payoutCap")}</span>
            <span className="font-mono">
              ${formatNumber(amount * 2, { decimals: 0 })}
            </span>
          </div>
        </div>

        {!isConnected ? (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t("staking.deposit.connectWalletFirst")}</span>
          </div>
        ) : needsSwitch ? (
          <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-2.5 text-xs text-info">
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {t("staking.deposit.switchToNetwork", {
                network: CHAIN_META[targetChainIdFor(network)].name,
              })}
            </span>
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" size="md" onClick={onCancel}>
          {t("staking.deposit.cancel")}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={!isConnected || !amountValid}
        >
          {needsSwitch
            ? t("staking.deposit.switchAndContinue")
            : t("staking.deposit.continue")}{" "}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );
}

function NetworkOption({
  network,
  active,
  onSelect,
}: {
  network: StakingNetwork;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const meta = CHAIN_META[targetChainIdFor(network)];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2.5 rounded-md border bg-bg-base/60 px-3 py-2.5 text-left transition-colors",
        active
          ? "border-gold/50 bg-gold/10"
          : "border-border-subtle hover:border-border-strong",
      )}
    >
      <span
        className="h-7 w-7 shrink-0 rounded-full"
        style={{ background: meta.color, opacity: 0.9 }}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            active ? "text-gold" : "text-text-primary",
          )}
        >
          {meta.short}
        </p>
        <p className="truncate text-[11px] text-text-muted">
          {t(`staking.deposit.networkSubtitle.${network}`)}
        </p>
      </div>
    </button>
  );
}

function WalletStep({ network }: { network: StakingNetwork }) {
  const { t } = useI18n();
  const meta = CHAIN_META[targetChainIdFor(network)];
  return (
    <DialogBody className="flex flex-col items-center gap-4 py-8">
      <div className="relative">
        <span
          className="absolute inset-0 -m-2 animate-pulse-soft rounded-full"
          style={{ boxShadow: `0 0 0 6px ${meta.color}33` }}
          aria-hidden
        />
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border-subtle bg-bg-base"
          style={{ borderColor: `${meta.color}80` }}
        >
          <Wallet className="h-6 w-6 text-gold" />
        </div>
      </div>
      <p className="text-center text-sm text-text-secondary">
        {t("staking.deposit.walletInstructions", { network: meta.short })}
      </p>
      <Badge variant="gold" className="mt-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("staking.deposit.awaitingSignature")}
      </Badge>
    </DialogBody>
  );
}

function ConfirmingStep({
  txHash,
  network,
  confirmations,
  required,
}: {
  txHash: string;
  network: StakingNetwork;
  confirmations: number;
  required: number;
}) {
  const { t } = useI18n();
  const meta = CHAIN_META[targetChainIdFor(network)];
  const pct = (confirmations / required) * 100;
  return (
    <DialogBody className="space-y-4">
      <div className="flex items-center justify-center py-4">
        <ConfirmationsRing pct={pct} value={`${confirmations}/${required}`} />
      </div>
      <p className="text-center text-sm text-text-secondary">
        {t("staking.deposit.confirmingHint", { network: meta.short })}
      </p>
      <div className="rounded-md border border-border-subtle bg-bg-base/60 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">{t("staking.deposit.txHash")}</span>
          <a
            href={explorerUrl(network, txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-gold hover:text-gold-bright"
          >
            {shortenHash(txHash)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </DialogBody>
  );
}

function ConfirmationsRing({
  pct,
  value,
}: {
  pct: number;
  value: string;
}) {
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const safePct = Number.isFinite(pct)
    ? Math.min(100, Math.max(0, pct))
    : 0;
  const offset = circ - (safePct / 100) * circ;
  return (
    <div className="relative h-28 w-28">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 112 112">
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="hsl(228 11% 16%)"
          strokeWidth="8"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="url(#dep-grad)"
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-300"
        />
        <defs>
          <linearGradient id="dep-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0C75E" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base text-text-primary">{value}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-text-muted">
          conf.
        </span>
      </div>
    </div>
  );
}

function SuccessStep({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
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
            {t("staking.deposit.successHeadline")}
          </p>
          <p className="text-sm text-text-secondary">
            {t("staking.deposit.successDescription")}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="gold">
            <Lock className="h-3 w-3" />
            {t("staking.deposit.lockedBadge")}
          </Badge>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button asChild variant="outline" size="md">
          <Link href="/dashboard/portfolio" onClick={onClose}>
            {t("staking.deposit.viewPortfolio")}
          </Link>
        </Button>
        <Button variant="primary" size="md" onClick={onClose}>
          {t("staking.deposit.done")}
        </Button>
      </DialogFooter>
    </>
  );
}
