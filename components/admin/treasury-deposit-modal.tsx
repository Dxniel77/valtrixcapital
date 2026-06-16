"use client";

import * as React from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
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
import { DepositAddressPanel } from "@/components/staking/deposit-address-panel";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import { useTreasuryStore } from "@/lib/admin/treasury-store";
import { getDepositAddress } from "@/lib/wallet/deposit-addresses";
import type { StakingNetwork } from "@/lib/staking/store";
import {
  cn,
  explorerUrl,
  formatNumber,
  shortenHash,
} from "@/lib/utils";

type Step = "form" | "transfer" | "confirming" | "success";

interface TreasuryDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TreasuryDepositModal({
  open,
  onOpenChange,
}: TreasuryDepositModalProps) {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();

  const [step, setStep] = React.useState<Step>("form");
  const [amountStr, setAmountStr] = React.useState("1000");
  const [network, setNetwork] = React.useState<StakingNetwork>("BSC");
  const [txHashInput, setTxHashInput] = React.useState("");

  const beginDeposit = useTreasuryStore((s) => s.beginDeposit);
  const advance = useTreasuryStore((s) => s.advanceDepositConfirmation);
  const finalize = useTreasuryStore((s) => s.finalizePendingDeposit);
  const cancel = useTreasuryStore((s) => s.cancelPendingDeposit);
  const pending = useTreasuryStore((s) => s.pendingDeposit);

  React.useEffect(() => {
    if (!open) return;
    setStep("form");
    setTxHashInput("");
  }, [open]);

  const amount = Number(amountStr.replace(/,/g, "."));
  const amountValid = Number.isFinite(amount) && amount > 0;

  function handleContinue() {
    if (!amountValid) {
      toast.error(t("admin.treasury.amountRequired"));
      return;
    }
    setStep("transfer");
  }

  function handleConfirmSent() {
    if (!isConnected || !address) {
      toast.error(t("staking.deposit.connectForCredit"));
      return;
    }

    const trimmedHash = txHashInput.trim();
    const hash =
      trimmedHash && /^0x[a-fA-F0-9]{64}$/.test(trimmedHash)
        ? trimmedHash
        : `0x${Date.now().toString(16).padStart(64, "0").slice(0, 64)}`;

    beginDeposit({ amount, network, txHash: hash });
    setStep("confirming");
  }

  React.useEffect(() => {
    if (step !== "confirming" || !pending) return;
    if (pending.confirmations >= pending.requiredConfirmations) return;
    const id = window.setInterval(() => advance(), 450);
    return () => window.clearInterval(id);
  }, [step, pending, advance]);

  React.useEffect(() => {
    if (step !== "confirming" || !pending) return;
    if (pending.confirmations < pending.requiredConfirmations) return;

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
  }, [step, pending, finalize, network, amount, t]);

  function handleClose(next: boolean) {
    if (!next) {
      if (step === "confirming") cancel();
      setStep("form");
      setTxHashInput("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showClose={step !== "confirming"}>
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
              <DepositAddressPanel
                network={network}
                onNetworkChange={setNetwork}
                showNetworkSelector
              />
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {t("staking.deposit.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleContinue}
                disabled={!amountValid}
              >
                {t("staking.deposit.continue")} <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "transfer" ? (
          <>
            <DialogBody className="space-y-4">
              <div className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-sm">
                {t("staking.deposit.sendAmount")}{" "}
                <span className="font-mono font-semibold text-gold">
                  ${formatNumber(amount, { decimals: 2 })} USDT
                </span>
              </div>
              <DepositAddressPanel
                network={network}
                onNetworkChange={setNetwork}
                amount={amount}
              />
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-text-muted">
                  {t("staking.deposit.txHashLabel")}
                </label>
                <input
                  type="text"
                  value={txHashInput}
                  onChange={(e) => setTxHashInput(e.target.value)}
                  placeholder={t("staking.deposit.txHashPlaceholder")}
                  className="h-10 w-full rounded-md border border-border-subtle bg-bg-base px-3 font-mono text-sm outline-none focus:border-gold"
                />
              </div>
              <p className="text-xs text-text-muted">
                {t("admin.treasury.depositTo", {
                  address: getDepositAddress(network),
                })}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("form")}>
                {t("staking.deposit.back")}
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSent}
                disabled={!isConnected}
              >
                {t("admin.treasury.confirmDeposit")}
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "confirming" && pending ? (
          <DialogBody className="space-y-4 py-4">
            <p className="text-center text-sm text-text-secondary">
              {t("staking.deposit.confirmingHint", { network })}
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
