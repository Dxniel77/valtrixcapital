"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="rounded-md p-2 text-text-secondary hover:bg-bg-hover md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="md:hidden">
          <Logo size="sm" />
        </div>

        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            placeholder="Search pairs, trades, users…"
            className="h-9 w-[280px] rounded-md border border-border-subtle bg-bg-base pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <BalancePill />
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-md border border-border-subtle bg-bg-base p-2 text-text-secondary hover:border-border-strong hover:text-text-primary"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" />
        </button>
        <ConnectWalletButton size="md" compact />
      </div>
    </header>
  );
}

function BalancePill() {
  return (
    <Link
      href="/dashboard/wallet"
      className={cn(
        "hidden items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-3 py-1.5 text-xs sm:inline-flex",
        "hover:border-gold/30",
      )}
    >
      <span className="text-text-muted">Balance</span>
      <span className="font-mono text-text-primary">10,450.00</span>
      <span className="text-text-muted">USDT</span>
    </Link>
  );
}
