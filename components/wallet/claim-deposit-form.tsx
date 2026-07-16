"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAccount, useChainId } from "wagmi";
import { polygon } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import {
  ApiError,
  claimDepositByTxHash,
  fetchUserPortfolio,
} from "@/lib/api/client";
import { hydratePortfolioFromServer } from "@/lib/staking/hydrate-portfolio";
import type { PortfolioDto } from "@/lib/staking/portfolio-types";
import { useStakingStore, type StakingNetwork } from "@/lib/staking/store";
import { cn } from "@/lib/utils";

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function claimErrorMessage(t: Translate, code?: string): string {
  switch (code) {
    case "NOT_FOUND":
    case "TX_NOT_VERIFIED":
      return t("walletPage.deposit.claimNotVerified");
    case "TX_OWNED_BY_OTHER":
    case "DUPLICATE_TX":
      return t("walletPage.deposit.claimOwnedByOther");
    case "INVALID_AMOUNT":
      return t("walletPage.deposit.claimInvalidAmount");
    case "TX_REVERTED":
      return t("walletPage.deposit.claimReverted");
    default:
      return t("walletPage.deposit.claimFailed");
  }
}

/**
 * Lets a user attach a real on-chain USDT transfer to their account by pasting
 * its transaction hash. Recovers deposits that were never registered, or whose
 * recorded transaction failed (the correct successful hash can be claimed here).
 */
export function ClaimDepositForm() {
  const { t } = useI18n();
  const backend = useBackendAvailable();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [network, setNetwork] = React.useState<StakingNetwork>(
    chainId === polygon.id ? "POLYGON" : "BSC",
  );
  const [txHash, setTxHash] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!backend) return null;

  const trimmed = txHash.trim();
  const hashValid = TX_HASH_RE.test(trimmed);

  async function handleSubmit() {
    if (!hashValid) {
      toast.error(t("walletPage.deposit.claimInvalidHash"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await claimDepositByTxHash({ network, txHash: trimmed });
      const deposit = res.deposit as { status?: string } | undefined;

      try {
        const portfolio = await fetchUserPortfolio();
        if (portfolio.backend && portfolio.portfolio) {
          hydratePortfolioFromServer(portfolio.portfolio as PortfolioDto);
        }
      } catch {
        /* portfolio refresh is best-effort */
      }

      if (deposit?.status === "CONFIRMED") {
        toast.success(t("walletPage.deposit.claimSuccess"));
        setTxHash("");
      } else {
        toast.success(t("walletPage.deposit.pendingTitle"));
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.payload.code : undefined;
      toast.error(claimErrorMessage(t, code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("walletPage.deposit.claimTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-text-secondary">
          {t("walletPage.deposit.claimDesc")}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {(["BSC", "POLYGON"] as StakingNetwork[]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNetwork(n)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                network === n
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-border-subtle text-text-secondary hover:border-border-strong",
              )}
            >
              {n === "POLYGON" ? "Polygon" : "BSC"}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder={t("walletPage.deposit.claimPlaceholder")}
          spellCheck={false}
          className={cn(
            "w-full rounded-md border bg-bg-base px-3 py-2 font-mono text-sm text-text-primary outline-none",
            trimmed === "" || hashValid
              ? "border-border-subtle focus:border-gold"
              : "border-danger/60",
          )}
        />

        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={handleSubmit}
          disabled={!isConnected || !hashValid || submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("walletPage.deposit.claimSubmit")}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PendingDepositBanner() {
  const { t } = useI18n();
  const pending = useStakingStore((s) => s.pendingDeposit);

  if (!pending) return null;

  const networkLabel = pending.network === "POLYGON" ? "Polygon" : "BSC";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gold">{t("walletPage.deposit.pendingTitle")}</p>
        <p className="mt-1 text-text-secondary">
          {t("walletPage.deposit.pendingDesc", {
            amount: pending.amount.toFixed(2),
            network: networkLabel,
            current: pending.confirmations,
            required: pending.requiredConfirmations,
          })}
        </p>
      </div>
    </div>
  );
}
