"use client";

import * as React from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { bsc, polygon } from "wagmi/chains";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, Wallet } from "lucide-react";
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
import { useUsdtDeposit } from "@/lib/hooks/use-usdt-deposit";
import { allowOfflineSimulation } from "@/lib/runtime-mode";
import { useAdminStore } from "@/lib/admin/store";
import { useTreasuryStore } from "@/lib/admin/treasury-store";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import {
  advanceTreasuryDepositOnBackend,
  beginTreasuryDepositOnBackend,
  syncTreasuryFromBackend,
} from "@/lib/admin/treasury-backend";
import { REQUIRED_CONFIRMATIONS } from "@/lib/staking/constants";
import { getDepositAddress } from "@/lib/wallet/deposit-addresses";
import { CHAIN_META } from "@/lib/wagmi";
import type { StakingNetwork } from "@/lib/staking/store";
import {
  cn,
  explorerUrl,
  formatNumber,
  shortenHash,
} from "@/lib/utils";

type Step = "form" | "wallet" | "confirming" | "success";

interface TreasuryDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function targetChainIdFor(network: StakingNetwork): number {
  return network === "POLYGON" ? polygon.id : bsc.id;
}

export function TreasuryDepositModal({
  open,
  onOpenChange,
}: TreasuryDepositModalProps) {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { deposit: sendUsdtDeposit } = useUsdtDeposit();
  const backend = useBackendAvailable();

  const [step, setStep] = React.useState<Step>("form");
  const [amountStr, setAmountStr] = React.useState("1000");
  const [network, setNetwork] = React.useState<StakingNetwork>(() =>
    chainId === polygon.id ? "POLYGON" : "BSC",
  );
  const [backendDeposit, setBackendDeposit] = React.useState(false);
  const confirmStartedRef = React.useRef(false);

  const beginDeposit = useTreasuryStore((s) => s.beginDeposit);
  const advance = useTreasuryStore((s) => s.advanceDepositConfirmation);
  const finalize = useTreasuryStore((s) => s.finalizePendingDeposit);
  const cancel = useTreasuryStore((s) => s.cancelPendingDeposit);
  const pending = useTreasuryStore((s) => s.pendingDeposit);

  React.useEffect(() => {
    if (chainId === polygon.id) setNetwork("POLYGON");
    else if (chainId === bsc.id) setNetwork("BSC");
  }, [chainId]);

  React.useEffect(() => {
    if (!open) return;
    setStep("form");
    setBackendDeposit(false);
    confirmStartedRef.current = false;
  }, [open]);

  const amount = Number(amountStr.replace(/,/g, "."));
  const amountValid = Number.isFinite(amount) && amount > 0;
  const targetChainId = targetChainIdFor(network);
  const needsSwitch = isConnected && chainId !== targetChainId;

  async function handleContinue() {
    if (!isConnected || !address) {
      toast.error(t("staking.deposit.connectWalletFirst"));
      return;
    }
    if (!amountValid) {
      toast.error(t("admin.treasury.amountRequired"));
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

    try {
      const useBackend = backend;
      setBackendDeposit(useBackend);

      if (allowOfflineSimulation() && !useBackend) {
        beginDeposit({ amount, network });
        window.setTimeout(() => setStep("confirming"), 1600);
        return;
      }

      if (allowOfflineSimulation() && useBackend) {
        const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(66, "0").slice(0, 66);
        await beginTreasuryDepositOnBackend({
          amount,
          network,
          txHash,
          requiredConfirmations: REQUIRED_CONFIRMATIONS,
        });
        window.setTimeout(() => setStep("confirming"), 1600);
        return;
      }

      const toAddress = getDepositAddress(network);
      if (!toAddress) {
        toast.error(t("staking.deposit.treasuryMissing"));
        setStep("form");
        return;
      }

      const txHash = await sendUsdtDeposit({
        network,
        amount,
        toAddress: toAddress as `0x${string}`,
      });

      if (useBackend) {
        await beginTreasuryDepositOnBackend({
          amount,
          network,
          txHash,
          requiredConfirmations: REQUIRED_CONFIRMATIONS,
        });
      } else {
        beginDeposit({ amount, network, txHash });
      }
      setStep("confirming");
    } catch (err) {
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
    if (step !== "confirming" || !pending) return;

    const id = window.setInterval(() => {
      if (backendDeposit) {
        void advanceTreasuryDepositOnBackend(pending.id)
          .then((deposit) => {
            if (deposit.status === "CONFIRMED") {
              cancel();
              void syncTreasuryFromBackend();
              setStep("success");
              toast.success(t("admin.treasury.depositConfirmed"));
              useAdminStore.setState((s) => ({
                audit: [
                  {
                    id: `aud_${Date.now()}`,
                    action: "TREASURY_DEPOSIT",
                    target: network,
                    detail: `+$${amount.toFixed(2)} USDT · ${shortenHash(deposit.txHash)}`,
                    actor: "admin",
                    timestamp: Date.now(),
                  },
                  ...s.audit,
                ].slice(0, 200),
              }));
            }
          })
          .catch(() => undefined);
      } else {
        advance();
      }
    }, backendDeposit ? 3_000 : 450);
    return () => window.clearInterval(id);
  }, [step, pending, advance, backendDeposit, cancel, network, amount, t]);

  React.useEffect(() => {
    if (step !== "confirming" || !pending || backendDeposit) return;
    if (pending.confirmations < pending.requiredConfirmations) return;
    if (confirmStartedRef.current) return;
    confirmStartedRef.current = true;

    const confirmed = finalize();
    if (confirmed) {
      useAdminStore.setState((s) => ({
        audit: [
          {
            id: `aud_${Date.now()}`,
            action: "TREASURY_DEPOSIT",
            target: network,
            detail: `+$${amount.toFixed(2)} USDT · ${shortenHash(confirmed.txHash)}`,
            actor: "admin",
            timestamp: Date.now(),
          },
          ...s.audit,
        ].slice(0, 200),
      }));
      setStep("success");
      toast.success(t("admin.treasury.depositConfirmed"));
    }
  }, [step, pending, finalize, backendDeposit, network, amount, t]);

  function handleClose(next: boolean) {
    if (!next) {
      if (step === "wallet" || step === "confirming") cancel();
      setStep("form");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showClose={step !== "wallet" && step !== "confirming"}>
        <DialogHeader>
          <DialogTitle>{t(`admin.treasury.depositStep.${step}`)}</DialogTitle>
          <DialogDescription>
            {t("admin.treasury.depositSubtitle")}
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <>
            <DialogBody className="space-y-4">
              <p className="text-sm text-text-secondary">
                {t("admin.treasury.depositExplain")}
              </p>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-text-muted">
                  {t("admin.treasury.amountLabel")}
                </label>
                <div
                  className={cn(
                    "flex h-12 items-center gap-2 rounded-md border bg-bg-base px-3",
                    amountValid || amountStr === ""
                      ? "border-border-subtle focus-within:border-gold"
                      : "border-danger/60",
                  )}
                >
                  <span className="font-mono text-text-muted">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full bg-transparent font-mono text-xl text-text-primary outline-none"
                  />
                  <span className="text-sm text-text-muted">USDT</span>
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
                    onSelect={() => setNetwork("BSC")}
                  />
                  <NetworkOption
                    network="POLYGON"
                    active={network === "POLYGON"}
                    onSelect={() => setNetwork("POLYGON")}
                  />
                </div>
              </div>

              {!isConnected ? (
                <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-warning">
                  {t("staking.deposit.connectWalletFirst")}
                </p>
              ) : needsSwitch ? (
                <p className="rounded-md border border-info/30 bg-info/5 px-3 py-2.5 text-xs text-info">
                  {t("staking.deposit.switchToNetwork", {
                    network: CHAIN_META[targetChainIdFor(network)].name,
                  })}
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {t("staking.deposit.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleContinue()}
                disabled={!amountValid || !isConnected}
              >
                {needsSwitch
                  ? t("staking.deposit.switchAndContinue")
                  : t("staking.deposit.continue")}{" "}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "wallet" ? (
          <WalletStep network={network} amount={amount} />
        ) : null}

        {step === "confirming" && pending ? (
          <DialogBody className="space-y-4 py-4">
            <p className="text-center text-sm text-text-secondary">
              {t("staking.deposit.confirmingHint", {
                network: CHAIN_META[targetChainIdFor(network)].short,
              })}
            </p>
            <p className="text-center font-mono text-lg text-text-primary">
              {pending.confirmations}/{pending.requiredConfirmations}
            </p>
            <a
              href={explorerUrl(network, pending.txHash)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-gold"
            >
              {shortenHash(pending.txHash)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </DialogBody>
        ) : null}

        {step === "success" ? (
          <>
            <DialogBody className="space-y-4 py-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <p className="text-sm text-text-secondary">
                {t("admin.treasury.depositSuccess", {
                  amount: formatNumber(amount, { decimals: 2 }),
                  network,
                })}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="primary" onClick={() => handleClose(false)}>
                {t("staking.deposit.done")}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
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

function WalletStep({
  network,
  amount,
}: {
  network: StakingNetwork;
  amount: number;
}) {
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
        {t("admin.treasury.depositWalletHint", {
          amount: formatNumber(amount, { decimals: 2 }),
          network: meta.short,
        })}
      </p>
      <Badge variant="gold" className="mt-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("staking.deposit.awaitingSignature")}
      </Badge>
    </DialogBody>
  );
}
