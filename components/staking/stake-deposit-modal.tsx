"use client";

import * as React from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lock,
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
import { DepositAddressPanel } from "@/components/staking/deposit-address-panel";
import { useI18n } from "@/lib/i18n/context";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import {
  advanceDepositOnServer,
  confirmDepositOnServer,
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
  shortenAddress,
  shortenHash,
} from "@/lib/utils";
import { bsc, polygon } from "wagmi/chains";

type Step = "form" | "transfer" | "confirming" | "success";

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
  const backend = useBackendAvailable();

  const [step, setStep] = React.useState<Step>("form");
  const [amountStr, setAmountStr] = React.useState<string>("250");
  const [network, setNetwork] = React.useState<StakingNetwork>("BSC");
  const [txHashInput, setTxHashInput] = React.useState("");

  const beginDeposit = useStakingStore((s) => s.beginDeposit);
  const advance = useStakingStore((s) => s.advanceDepositConfirmation);
  const finalize = useStakingStore((s) => s.finalizePendingDeposit);
  const cancel = useStakingStore((s) => s.cancelPendingDeposit);
  const pending = useStakingStore((s) => s.pendingDeposit);
  const { minStakeUsdt, maxStakeUsdt } = usePlatformSettings();

  React.useEffect(() => {
    if (!open) return;
    setStep("form");
    setTxHashInput("");
  }, [open]);

  const amount = Number(amountStr.replace(/,/g, "."));
  const amountValid =
    Number.isFinite(amount) &&
    amount >= minStakeUsdt &&
    amount <= maxStakeUsdt;

  const dailyMin = amountValid ? amount * 0.003 : 0;
  const dailyMax = amountValid ? amount * 0.01 : 0;

  function handleContinueToTransfer() {
    if (!amountValid) {
      toast.error(
        amount < minStakeUsdt
          ? t("staking.deposit.amountTooLow")
          : t("staking.deposit.amountTooHigh"),
      );
      return;
    }
    setStep("transfer");
  }

  async function handleConfirmSent() {
    if (!isConnected || !address) {
      toast.error(t("staking.deposit.connectForCredit"));
      return;
    }

    try {
      let serverDepositId: string | undefined;
      const trimmedHash = txHashInput.trim();
      const toAddress = getDepositAddress(network);

      if (backend) {
        const hash =
          trimmedHash && /^0x[a-fA-F0-9]{64}$/.test(trimmedHash)
            ? trimmedHash
            : `0x${Date.now().toString(16).padStart(64, "0").slice(0, 64)}`;

        const res = await registerDepositRequest({
          network,
          amount,
          fromAddress: address,
          toAddress,
          txHash: hash,
        });
        serverDepositId = res.deposit.id;
        beginDeposit({
          amount,
          network,
          txHash: hash,
          serverDepositId,
        });
      } else {
        beginDeposit({ amount, network, txHash: txHashInput });
      }

      setStep("confirming");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.signInFailed"));
    }
  }

  React.useEffect(() => {
    if (step !== "confirming") return;
    if (!pending) return;
    if (pending.confirmations >= pending.requiredConfirmations) return;
    const id = window.setInterval(() => {
      advance();
      const depositId = pending.serverDepositId ?? pending.id;
      if (backend && depositId) {
        void advanceDepositOnServer(depositId).catch(() => undefined);
      }
    }, 450);
    return () => window.clearInterval(id);
  }, [step, pending, advance, backend]);

  React.useEffect(() => {
    if (step !== "confirming") return;
    if (!pending) return;
    if (pending.confirmations < pending.requiredConfirmations) return;

    async function complete() {
      const depositId = pending?.serverDepositId ?? pending?.id;
      if (backend && depositId) {
        try {
          await confirmDepositOnServer(depositId);
          cancel();
          setStep("success");
          toast.success(t("staking.deposit.toastConfirmed"));
          return;
        } catch {
          toast.error(t("errors.signInFailed"));
          return;
        }
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
      if (step === "confirming") {
        cancel();
      }
      setStep("form");
      setTxHashInput("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showClose={step !== "confirming"}>
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
            address={address}
            onContinue={handleContinueToTransfer}
            onCancel={() => handleClose(false)}
          />
        ) : null}

        {step === "transfer" ? (
          <TransferStep
            amount={amount}
            network={network}
            onNetworkChange={setNetwork}
            txHashInput={txHashInput}
            onTxHashChange={setTxHashInput}
            isConnected={isConnected}
            address={address}
            onConfirmSent={handleConfirmSent}
            onBack={() => setStep("form")}
          />
        ) : null}

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
    case "transfer":
      return t("staking.deposit.transferTitle");
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
    case "transfer":
      return t("staking.deposit.transferSubtitle");
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
  address,
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
  address?: string;
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

        {isConnected && address ? (
          <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-2.5 text-xs text-info">
            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {t("staking.deposit.accountNote", {
                address: shortenAddress(address),
              })}
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">
            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t("staking.deposit.connectForCredit")}</span>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" size="md" onClick={onCancel}>
          {t("staking.deposit.cancel")}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={!amountValid}
        >
          {t("staking.deposit.continue")}{" "}
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

function TransferStep({
  amount,
  network,
  onNetworkChange,
  txHashInput,
  onTxHashChange,
  isConnected,
  address,
  onConfirmSent,
  onBack,
}: {
  amount: number;
  network: StakingNetwork;
  onNetworkChange: (n: StakingNetwork) => void;
  txHashInput: string;
  onTxHashChange: (v: string) => void;
  isConnected: boolean;
  address?: string;
  onConfirmSent: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const steps = [
    t("walletPage.deposit.stepAmount"),
    t("walletPage.deposit.stepNetwork"),
    t("walletPage.deposit.stepSend"),
    t("walletPage.deposit.stepConfirm"),
  ];

  return (
    <>
      <DialogBody className="space-y-5">
        <ol className="space-y-1.5 text-xs text-text-secondary">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-gold">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <DepositAddressPanel
          network={network}
          onNetworkChange={onNetworkChange}
          amount={amount}
        />

        <div className="space-y-2">
          <label
            htmlFor="deposit-tx-hash"
            className="text-xs uppercase tracking-wider text-text-muted"
          >
            {t("staking.deposit.txHashLabel")}
          </label>
          <input
            id="deposit-tx-hash"
            type="text"
            value={txHashInput}
            onChange={(e) => onTxHashChange(e.target.value)}
            placeholder={t("staking.deposit.txHashPlaceholder")}
            className="h-10 w-full rounded-md border border-border-subtle bg-bg-base px-3 font-mono text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-gold"
          />
          <p className="text-xs text-text-muted">
            {t("staking.deposit.txHashHint")}
          </p>
        </div>

        {isConnected && address ? (
          <p className="text-xs text-text-muted">
            {t("staking.deposit.accountNote", {
              address: shortenAddress(address),
            })}
          </p>
        ) : (
          <p className="text-xs text-warning">
            {t("staking.deposit.connectForCredit")}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" size="md" onClick={onBack}>
          {t("staking.deposit.back")}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onConfirmSent}
          disabled={!isConnected}
        >
          {t("staking.deposit.confirmSent")}
        </Button>
      </DialogFooter>
    </>
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
