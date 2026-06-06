"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { useI18n, useLocaleMeta } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

/** Locales whose nav labels tend to run long on desktop */
const COMPACT_NAV_LOCALES = new Set(["es", "de", "fr", "pt", "hi", "ar"]);

export function MarketingNav() {
  const { t, locale } = useI18n();
  const { dir } = useLocaleMeta();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const compactNav = COMPACT_NAV_LOCALES.has(locale);

  const links = React.useMemo(
    () => [
      { href: "/#features", label: t("nav.features") },
      { href: "/#how", label: t("nav.how") },
      { href: "/#yield", label: t("nav.yield") },
      { href: "/#referrals", label: t("nav.referrals") },
    ],
    [t],
  );

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      dir={dir}
      className={cn(
        "sticky top-0 z-50 transition-all",
        scrolled ? "glass border-b border-border-subtle" : "bg-transparent",
      )}
    >
      <div className="container flex h-16 items-center gap-3 lg:h-[4.5rem] lg:gap-4">
        <div className="flex shrink-0 items-center">
          <Logo className="flex" size="lg" showWordmark />
        </div>

        <nav
          aria-label="Main"
          className="hidden min-w-0 flex-1 md:block"
        >
          <ul
            className={cn(
              "flex items-center justify-center",
              compactNav
                ? "gap-2.5 lg:gap-4 xl:gap-6"
                : "gap-4 lg:gap-6 xl:gap-8",
            )}
          >
            {links.map((l) => (
              <li key={l.href} className="min-w-0">
                <Link
                  href={l.href}
                  className={cn(
                    "block whitespace-nowrap font-medium text-text-secondary transition-colors hover:text-text-primary",
                    compactNav
                      ? "text-[13px] lg:text-sm xl:text-[15px]"
                      : "text-sm lg:text-[15px] xl:text-base",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div
            className={cn(
              "hidden items-center rounded-lg border border-border-subtle/70 bg-bg-base/50 p-0.5 md:flex",
              dir === "rtl" ? "flex-row-reverse" : "flex-row",
            )}
          >
            <LanguageSelector variant="header" />
            <ThemeToggle size="icon" className="h-9 w-9 shrink-0" />
          </div>

          <div
            aria-hidden
            className="mx-0.5 hidden h-7 w-px bg-border-subtle lg:block"
          />

          <Button
            asChild
            variant="ghost"
            size="lg"
            className="hidden px-3 text-sm lg:inline-flex xl:text-base"
          >
            <Link href="/dashboard">{t("nav.dashboard")}</Link>
          </Button>

          <ConnectWalletButton
            size="lg"
            className="hidden md:inline-flex"
            compact={compactNav}
          />

          <div className="flex items-center gap-0.5 md:hidden">
            <LanguageSelector variant="header" />
            <ThemeToggle size="icon" />
            <button
              type="button"
              className="rounded-md p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              onClick={() => setOpen((v) => !v)}
              aria-label={t("nav.toggleMenu")}
              aria-expanded={open}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border-subtle bg-bg-elevated md:hidden">
          <div className="container flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-2 py-2.5 text-base font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-4">
              <Button asChild variant="outline" size="md">
                <Link href="/dashboard" onClick={() => setOpen(false)}>
                  {t("nav.openDashboard")}
                </Link>
              </Button>
              <ConnectWalletButton size="md" />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
