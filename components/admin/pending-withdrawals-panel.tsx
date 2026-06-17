"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { useAdminStore, type AdminMovement } from "@/lib/admin/store";
import { useTreasuryStore } from "@/lib/admin/treasury-store";
import { useWalletStore } from "@/lib/wallet/store";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import {
  adminUpdateWithdrawalStatus,
  fetchPendingWithdrawals,
} from "@/lib/api/client";
import {
  explorerUrl,
  formatNumber,
  shortenAddress,
  shortenHash,
} from "@/lib/utils";

export function PendingWithdrawalsPanel({ limit = 12 }: { limit?: number }) {
  const { t } = useI18n();
  const backend = useBackendAvailable();
  const movements = useAdminStore((s) => s.movements);
  const processMovement = useAdminStore((s) => s.processWithdrawalMovement);
  const deductForPayout = useTreasuryStore((s) => s.deductForPayout);
  const adminSetWithdrawal = useWalletStore((s) => s.adminSetWithdrawalStatus);

  const [txHashes, setTxHashes] = React.useState<Record<string, string>>({});
  const [backendRows, setBackendRows] = React.useState<
    Awaited<ReturnType<typeof fetchPendingWithdrawals>>["withdrawals"]
  >([]);
  const [loading, setLoading] = React.useState(false);

  const localPending = React.useMemo(
    () =>
      movements
        .filter(
          (m) =>
            m.type === "WITHDRAWAL" &&
            m.status !== "COMPLETED" &&
            m.status !== "REJECTED",
        )
        .slice(0, limit),
    [movements, limit],
  );

  React.useEffect(() => {
    if (!backend) return;
    let cancelled = false;

    function load() {
      void fetchPendingWithdrawals()
        .then((res) => {
          if (!cancelled) setBackendRows(res.withdrawals ?? []);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    setLoading(true);
    load();
    // Poll on a fixed cadence instead of refetching on every `movements`
    // mutation (the admin movement bridge updates it constantly).
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [backend]);

  function syncLocalWallet(movement: AdminMovement, status: string) {
    const match = movement.id.match(/^live_wd_(.+)$/);
    if (!match) return;
    adminSetWithdrawal(
      match[1],
      status as "REVIEW" | "PROCESSING" | "COMPLETED" | "REJECTED",
      txHashes[movement.id],
    );
  }

  function handleLocalAction(
    movement: AdminMovement,
    status: string,
  ) {
    const result = processMovement(movement.id, status, txHashes[movement.id]);
    if (!result.ok) {
      toast.error(t("admin.withdrawals.actionFailed"));
      return;
    }

    syncLocalWallet(movement, status);

    if (status === "COMPLETED") {
      const ok = deductForPayout(result.network, result.netAmount);
      if (!ok) {
        toast.warning(t("admin.treasury.insufficientForPayout"));
      } else {
        toast.success(t("admin.withdrawals.completed"));
      }
    } else if (status === "REJECTED") {
      syncLocalWallet(movement, "REJECTED");
      toast.success(t("admin.withdrawals.rejected"));
    } else {
      toast.success(t("admin.withdrawals.updated"));
    }
  }

  async function handleBackendAction(
    withdrawalId: string,
    status: "APPROVED" | "REJECTED" | "SENT" | "CONFIRMED",
    network: "BSC" | "POLYGON",
    netAmount: number,
  ) {
    try {
      await adminUpdateWithdrawalStatus({
        withdrawalId,
        status,
        txHash: txHashes[withdrawalId] || undefined,
      });
      if (status === "CONFIRMED") {
        const ok = deductForPayout(network, netAmount);
        if (!ok) toast.warning(t("admin.treasury.insufficientForPayout"));
      }
      const res = await fetchPendingWithdrawals();
      setBackendRows(res.withdrawals ?? []);
      toast.success(t("admin.withdrawals.updated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("admin.withdrawals.actionFailed"),
      );
    }
  }

  const showEmpty = !loading && localPending.length === 0 && backendRows.length === 0;

  return (
    <div className="space-y-4">
      {showEmpty ? (
        <p className="rounded-md border border-dashed border-border-subtle bg-bg-base/40 p-6 text-center text-sm text-text-secondary">
          {t("admin.overview.noPending")}
        </p>
      ) : null}

      {localPending.map((m) => (
        <WithdrawalRow
          key={m.id}
          wallet={m.wallet}
          amount={m.amount}
          network={m.network}
          status={m.status}
          txHash={txHashes[m.id]}
          onTxHashChange={(v) =>
            setTxHashes((prev) => ({ ...prev, [m.id]: v }))
          }
          onApprove={() => handleLocalAction(m, "REVIEW")}
          onProcess={() => handleLocalAction(m, "PROCESSING")}
          onComplete={() => handleLocalAction(m, "COMPLETED")}
          onReject={() => handleLocalAction(m, "REJECTED")}
        />
      ))}

      {backend
        ? backendRows.slice(0, limit).map((w) => (
            <WithdrawalRow
              key={w.id}
              wallet={w.walletAddress}
              amount={w.amount}
              network={w.network}
              status={mapBackendStatus(w.status)}
              txHash={txHashes[w.id] ?? w.txHash ?? ""}
              onTxHashChange={(v) =>
                setTxHashes((prev) => ({ ...prev, [w.id]: v }))
              }
              onApprove={() => void handleBackendAction(w.id, "APPROVED", w.network, w.netAmount)}
              onProcess={() => void handleBackendAction(w.id, "SENT", w.network, w.netAmount)}
              onComplete={() => void handleBackendAction(w.id, "CONFIRMED", w.network, w.netAmount)}
              onReject={() => void handleBackendAction(w.id, "REJECTED", w.network, w.netAmount)}
            />
          ))
        : null}
    </div>
  );
}

function mapBackendStatus(status: string): string {
  switch (status) {
    case "REQUESTED":
      return "REQUESTED";
    case "APPROVED":
      return "REVIEW";
    case "SENT":
      return "PROCESSING";
    default:
      return status;
  }
}

function WithdrawalRow({
  wallet,
  amount,
  network,
  status,
  txHash,
  onTxHashChange,
  onApprove,
  onProcess,
  onComplete,
  onReject,
}: {
  wallet: string;
  amount: number;
  network: string | null;
  status: string;
  txHash: string;
  onTxHashChange: (v: string) => void;
  onApprove: () => void;
  onProcess: () => void;
  onComplete: () => void;
  onReject: () => void;
}) {
  const { t } = useI18n();
  const fee = Math.round(amount * 0.04 * 100) / 100;
  const net = Math.round((amount - fee) * 100) / 100;

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-base/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="font-mono text-sm text-text-primary">
            {shortenAddress(wallet)}
          </p>
          <p className="text-xs text-text-muted">
            {network ?? "—"} · ${formatNumber(net, { decimals: 2 })} net
          </p>
        </div>
        <Badge variant="warning">{t(`walletPage.status.${status}`)}</Badge>
      </div>

      <Input
        value={txHash}
        onChange={(e) => onTxHashChange(e.target.value)}
        placeholder={t("admin.withdrawals.txHashPlaceholder")}
        className="font-mono text-xs"
      />

      <div className="flex flex-wrap gap-2">
        {status === "REQUESTED" ? (
          <Button size="sm" variant="outline" onClick={onApprove}>
            {t("admin.withdrawals.approve")}
          </Button>
        ) : null}
        {status === "REVIEW" ? (
          <Button size="sm" variant="outline" onClick={onProcess}>
            {t("admin.withdrawals.process")}
          </Button>
        ) : null}
        {status === "PROCESSING" ? (
          <Button size="sm" variant="primary" onClick={onComplete}>
            <Check className="h-3.5 w-3.5" />
            {t("admin.withdrawals.complete")}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onReject}>
          <X className="h-3.5 w-3.5" />
          {t("admin.withdrawals.reject")}
        </Button>
        {txHash && network ? (
          <a
            href={explorerUrl(network as "BSC" | "POLYGON", txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gold"
          >
            {shortenHash(txHash)}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
