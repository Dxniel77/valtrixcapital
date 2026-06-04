"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { useI18n } from "@/lib/i18n/context";
import { Menu, X } from "lucide-react";

export function MarketingNav() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  const links = [
    { href: "/#features", label: t("nav.features") },
    { href: "/#how", label: t("nav.how") },
    { href: "/#yield", label: t("nav.yield") },
    { href: "/#referrals", label: t("nav.referrals") },
  ];

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all ${
        scrolled
          ? "glass border-b border-border-subtle"
          : "bg-transparent"
      }`}
    >
      <div className="container flex h-20 items-center justify-between gap-4">
        <Logo className="flex" size="lg" showWordmark />

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-lg font-large text-text-secondary transition-colors hover:text-text-primary"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle size="icon" />
          <Button asChild variant="ghost" size="lg" className="text-lg">
            <Link href="/dashboard">{t("nav.dashboard")}</Link>
          </Button>
          <ConnectWalletButton size="lg" />
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle size="icon" />
          <button
            type="button"
            className="rounded-md p-2 text-text-secondary"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("nav.toggleMenu")}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border-subtle bg-bg-elevated md:hidden">
          <div className="container flex flex-col gap-3 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="py-1 text-lg font-large text-text-secondary"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild variant="outline" size="md">
                <Link href="/dashboard">{t("nav.openDashboard")}</Link>
              </Button>
              <ConnectWalletButton size="md" />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
