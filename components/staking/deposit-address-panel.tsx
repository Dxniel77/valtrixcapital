"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { bsc, polygon } from "wagmi/chains";

import { useI18n } from "@/lib/i18n/context";
import { CHAIN_META } from "@/lib/wagmi";
import type { StakingNetwork } from "@/lib/staking/store";
import {
  getDepositAddress,
  getUsdtContract,
} from "@/lib/wallet/deposit-addresses";
import { cn, formatNumber } from "@/lib/utils";

function targetChainId(network: StakingNetwork): number {
  return network === "POLYGON" ? polygon.id : bsc.id;
}

async function copyText(value: string, success: string, fail: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(success);
  } catch {
    toast.error(fail);
  }
}

export function DepositAddressPanel({
  network,
  onNetworkChange,
  showNetworkSelector = true,
  amount,
  className,
}: {
  network: StakingNetwork;
  onNetworkChange?: (network: StakingNetwork) => void;
  showNetworkSelector?: boolean;
  amount?: number;
  className?: string;
}) {
  const { t } = useI18n();
  const [copiedField, setCopiedField] = React.useState<
    "address" | "contract" | null
  >(null);

  const meta = CHAIN_META[targetChainId(network)];
  const depositAddress = getDepositAddress(network);
  const usdtContract = getUsdtContract(network);

  async function handleCopy(
    field: "address" | "contract",
    value: string,
  ) {
    await copyText(
      value,
      t("walletPage.deposit.copied"),
      t("walletPage.deposit.copyFailed"),
    );
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showNetworkSelector && onNetworkChange ? (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-text-muted">
            {t("staking.deposit.networkLabel")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["BSC", "POLYGON"] as const).map((n) => {
              const active = network === n;
              const chainMeta = CHAIN_META[targetChainId(n)];
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onNetworkChange(n)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border bg-bg-base/60 px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-gold/50 bg-gold/10"
                      : "border-border-subtle hover:border-border-strong",
                  )}
                >
                  <span
                    className="h-7 w-7 shrink-0 rounded-full"
                    style={{ background: chainMeta.color, opacity: 0.9 }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        active ? "text-gold" : "text-text-primary",
                      )}
                    >
                      {chainMeta.short}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">
                      {t(`staking.deposit.networkSubtitle.${n}`)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {amount != null && Number.isFinite(amount) && amount > 0 ? (
        <div className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2.5 text-sm">
          <span className="text-text-secondary">
            {t("staking.deposit.sendAmount")}{" "}
          </span>
          <span className="font-mono font-semibold text-gold">
            ${formatNumber(amount, { decimals: 2 })} USDT
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-2 self-center sm:self-start">
          <div className="rounded-xl border border-border-subtle bg-white p-3">
            <QRCodeSVG
              value={depositAddress}
              size={128}
              bgColor="#ffffff"
              fgColor="#0A0A0F"
              level="M"
            />
          </div>
          <span className="text-center text-xs text-text-muted">
            {t("staking.deposit.scanQr")}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <CopyField
            label={t("walletPage.deposit.addressLabel", {
              network: meta.short,
            })}
            value={depositAddress}
            copied={copiedField === "address"}
            onCopy={() => handleCopy("address", depositAddress)}
          />
          <CopyField
            label={t("walletPage.deposit.contractLabel")}
            value={usdtContract}
            copied={copiedField === "contract"}
            onCopy={() => handleCopy("contract", usdtContract)}
            mono
          />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {t("walletPage.deposit.warning", { network: meta.short })}
        </span>
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
  mono = true,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div>
      <label className="mb-1.5 block text-xs uppercase tracking-wider text-text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 py-2">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm text-text-primary",
            mono && "font-mono text-xs sm:text-sm",
          )}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-gold hover:bg-gold/10"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {t("walletPage.deposit.copy")}
        </button>
      </div>
    </div>
  );
}
