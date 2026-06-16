"use client";

import * as React from "react";
import { toast } from "sonner";
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
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore } from "@/lib/admin/store";
import { useTreasuryStore } from "@/lib/admin/treasury-store";
import type { StakingNetwork } from "@/lib/staking/store";
import { CHAIN_META } from "@/lib/wagmi";
import { bsc, polygon } from "wagmi/chains";
import { cn, formatNumber } from "@/lib/utils";

interface TreasuryWithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function chainId(network: StakingNetwork) {
  return network === "POLYGON" ? polygon.id : bsc.id;
}

export function TreasuryWithdrawModal({
  open,
  onOpenChange,
}: TreasuryWithdrawModalProps) {
  const { t } = useI18n();
  const balanceFor = useTreasuryStore((s) => s.balanceFor);
  const recordWithdrawal = useTreasuryStore((s) => s.recordWithdrawal);

  const [network, setNetwork] = React.useState<StakingNetwork>("BSC");
  const [amountStr, setAmountStr] = React.useState("");
  const [toAddress, setToAddress] = React.useState("");
  const [txHash, setTxHash] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const available = balanceFor(network);
  const amount = Number(amountStr.replace(/,/g, "."));
  const amountValid =
    Number.isFinite(amount) && amount > 0 && amount <= available;
  const addressValid = /^0x[0-9a-fA-F]{40}$/.test(toAddress.trim());

  React.useEffect(() => {
    if (!open) {
      setAmountStr("");
      setToAddress("");
      setTxHash("");
      setNote("");
    }
  }, [open]);

  function handleSubmit() {
    if (!amountValid) {
      toast.error(t("admin.treasury.withdrawInsufficient"));
      return;
    }
    if (!addressValid) {
      toast.error(t("admin.treasury.invalidAddress"));
      return;
    }

    setSubmitting(true);
    const result = recordWithdrawal({
      network,
      amount,
      toAddress: toAddress.trim(),
      txHash: txHash.trim() || undefined,
      note,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(t("admin.treasury.withdrawInsufficient"));
      return;
    }

    useAdminStore.setState((s) => ({
      audit: [
        {
          id: `aud_${Date.now()}`,
          action: "TREASURY_WITHDRAW",
          target: network,
          detail: `-$${amount.toFixed(2)} USDT → ${toAddress.slice(0, 10)}…`,
          actor: "admin",
          timestamp: Date.now(),
        },
        ...s.audit,
      ].slice(0, 200),
    }));

    toast.success(t("admin.treasury.withdrawRecorded"));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.treasury.withdrawTitle")}</DialogTitle>
          <DialogDescription>
            {t("admin.treasury.withdrawSubtitle")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("staking.deposit.networkLabel")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["BSC", "POLYGON"] as const).map((n) => {
                const active = network === n;
                const meta = CHAIN_META[chainId(n)];
                const bal = balanceFor(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNetwork(n)}
                    className={cn(
                      "rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-gold/50 bg-gold/10 text-gold"
                        : "border-border-subtle hover:border-border-strong",
                    )}
                  >
                    <p className="font-medium">{meta.short}</p>
                    <p className="font-mono text-xs text-text-muted">
                      ${formatNumber(bal, { decimals: 2 })} USDT
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.treasury.amountLabel")}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-base px-3 font-mono text-sm outline-none focus:border-gold"
            />
            <p className="text-xs text-text-muted">
              {t("admin.treasury.available", {
                amount: formatNumber(available, { decimals: 2 }),
              })}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.treasury.destinationLabel")}
            </label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x…"
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-base px-3 font-mono text-sm outline-none focus:border-gold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("staking.deposit.txHashLabel")}
            </label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder={t("admin.treasury.txHashOptional")}
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-base px-3 font-mono text-sm outline-none focus:border-gold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-text-muted">
              {t("admin.users.adjustNote")}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-base px-3 text-sm outline-none focus:border-gold"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("staking.deposit.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!amountValid || !addressValid || submitting}
          >
            {t("admin.treasury.recordWithdraw")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
