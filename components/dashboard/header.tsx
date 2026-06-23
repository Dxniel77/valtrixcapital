"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { Logo } from "@/components/brand/logo";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { useI18n, useLocaleMeta } from "@/lib/i18n/context";
import {
  useStakingStore,
  useStakingStoreHydrated,
  usePortfolioSummary,
} from "@/lib/staking/store";
import { useDashboardAccess } from "@/lib/hooks/use-dashboard-access";
import { cn, formatNumber } from "@/lib/utils";

const COMPACT_HEADER_LOCALES = new Set(["es", "de", "fr", "pt", "hi", "ar"]);

export function DashboardHeader({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const { t, locale } = useI18n();
  const { dir } = useLocaleMeta();
  const compact = COMPACT_HEADER_LOCALES.has(locale);

  return (
    <header
      dir={dir}
      className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-border-subtle bg-bg-elevated/80 px-4 backdrop-blur md:gap-3 md:px-6"
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-md p-2 text-text-secondary hover:bg-bg-hover md:hidden"
          aria-label={t("dashboard.header.openMenu")}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="md:hidden">
          <Logo size="sm" />
        </div>

        <div className="relative hidden md:block">
          <Search
            className={cn(
              "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted",
              dir === "rtl" ? "right-3" : "left-3",
            )}
          />
          <input
            type="search"
            placeholder={t("dashboard.header.search")}
            className={cn(
              "h-9 rounded-md border border-border-subtle bg-bg-base text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none",
              dir === "rtl" ? "pl-3 pr-9" : "pl-9 pr-3",
              compact ? "w-[220px] lg:w-[240px] xl:w-[280px]" : "w-[280px]",
            )}
          />
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5 md:gap-2",
          dir === "rtl" && "flex-row-reverse",
        )}
      >
        <div className="flex items-center rounded-lg border border-border-subtle/70 bg-bg-base/50 p-0.5">
          <LanguageSelector variant="header" />
          <ThemeToggle className="h-9 w-9 shrink-0" />
        </div>

        <BalancePill compact={compact} />

        <NotificationsPanel />

        <ConnectWalletButton size="md" compact={compact} />
      </div>
    </header>
  );
}

function BalancePill({ compact }: { compact: boolean }) {
  const { t } = useI18n();
  const { allowed } = useDashboardAccess();
  const hydrated = useStakingStoreHydrated();
  const earnings = useStakingStore((s) => s.earningsBalance);
  const { totalCapital } = usePortfolioSummary();

  if (!allowed) return null;

  return (
    <Link
      href="/dashboard/wallet"
      className={cn(
        "hidden items-center gap-2 rounded-md border border-border-subtle bg-bg-base py-1.5 text-xs hover:border-gold/30",
        compact ? "px-2 sm:inline-flex" : "px-3 sm:inline-flex",
      )}
      title={
        totalCapital > 0
          ? `${t("dashboard.header.capital")}: ${formatNumber(totalCapital, { decimals: 2 })} USDT`
          : undefined
      }
    >
      <span className={cn("text-text-muted", compact && "hidden lg:inline")}>
        {t("dashboard.header.balance")}
      </span>
      <span className="font-mono text-text-primary">
        {hydrated ? formatNumber(earnings, { decimals: 2 }) : "—"}
      </span>
      <span className="text-text-muted">USDT</span>
    </Link>
  );
}
