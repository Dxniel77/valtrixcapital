"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ChevronDown, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { cn, shortenAddress } from "@/lib/utils";

interface ConnectWalletButtonProps {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  compact?: boolean;
}

export function ConnectWalletButton({
  size = "md",
  variant = "primary",
  className,
  compact = false,
}: ConnectWalletButtonProps) {
  const { t } = useI18n();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          !!account &&
          !!chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
            className={cn("inline-flex items-center gap-2", className)}
          >
            {!connected ? (
              <Button
                onClick={openConnectModal}
                size={size}
                variant={variant}
                type="button"
                className={cn(compact && "gap-1.5 px-3 text-sm lg:px-3 xl:px-4 xl:text-base")}
                aria-label={t("common.connectWallet")}
              >
                <Wallet className="h-4 w-4 shrink-0" />
                <span className={cn(compact && "hidden xl:inline")}>
                  {t("common.connectWallet")}
                </span>
              </Button>
            ) : chain.unsupported ? (
              <Button
                onClick={openChainModal}
                size={size}
                variant="danger"
                type="button"
              >
                {t("common.wrongNetwork")}
              </Button>
            ) : (
              <>
                <Button
                  onClick={openChainModal}
                  size={size}
                  variant="outline"
                  type="button"
                  className="hidden md:inline-flex"
                >
                  {chain.hasIcon && chain.iconUrl ? (
                    <span
                      className="inline-block h-4 w-4 overflow-hidden rounded-full"
                      style={{ background: chain.iconBackground }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={chain.name ?? t("common.chain")}
                        src={chain.iconUrl}
                        className="h-full w-full"
                      />
                    </span>
                  ) : null}
                  <span className="text-xs">{chain.name}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>

                <Button
                  onClick={openAccountModal}
                  size={size}
                  variant={variant}
                  type="button"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-success animate-pulse-soft"
                    aria-hidden
                  />
                  {compact
                    ? shortenAddress(account.address, 4, 4)
                    : account.displayName}
                </Button>
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
