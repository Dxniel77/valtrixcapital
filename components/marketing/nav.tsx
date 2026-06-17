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
      <div className="container grid h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:h-16 sm:gap-3 lg:h-[4.5rem] lg:gap-4">
        <div className="flex shrink-0 items-center">
          <Logo className="flex md:hidden" size="md" />
          <Logo
            className={cn("hidden", compactNav && "md:flex xl:hidden")}
            size="md"
          />
          <Logo
            className={cn(
              "hidden",
              compactNav ? "xl:flex" : "md:flex",
            )}
            size="lg"
            showWordmark
          />
        </div>

        <nav
          aria-label="Main"
          className={cn(
            "hidden min-w-0 overflow-hidden",
            compactNav ? "xl:block" : "lg:block",
          )}
        >
          <ul
            className={cn(
              "flex min-w-0 items-center justify-center",
              compactNav
                ? "gap-2 xl:gap-4 2xl:gap-6"
                : "gap-3 lg:gap-5 xl:gap-6",
            )}
          >
            {links.map((l) => (
              <li key={l.href} className="min-w-0 shrink">
                <Link
                  href={l.href}
                  className={cn(
                    "block truncate font-medium text-text-secondary transition-colors hover:text-text-primary",
                    compactNav
                      ? "text-xs xl:text-sm 2xl:text-[15px]"
                      : "text-sm lg:text-[15px] xl:text-base",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5 lg:gap-2">
          <div
            className={cn(
              "hidden items-center rounded-lg border border-border-subtle/70 bg-bg-base/50 p-0.5",
              compactNav ? "xl:flex" : "md:flex",
              dir === "rtl" ? "flex-row-reverse" : "flex-row",
            )}
          >
            <LanguageSelector variant="header" compact={compactNav} />
            <ThemeToggle size="icon" className="h-9 w-9 shrink-0" />
          </div>

          <div
            aria-hidden
            className="mx-0.5 hidden h-7 w-px bg-border-subtle 2xl:block"
          />

          <Button
            asChild
            variant="ghost"
            size="lg"
            className={cn(
              "hidden px-3 text-sm 2xl:inline-flex 2xl:text-base",
              !compactNav && "xl:inline-flex",
            )}
          >
            <Link href="/dashboard">{t("nav.dashboard")}</Link>
          </Button>

          <ConnectWalletButton
            size="lg"
            className={cn(
              "hidden",
              compactNav ? "xl:inline-flex" : "md:inline-flex",
            )}
            compact={compactNav}
          />

          <div
            className={cn(
              "flex min-w-0 items-center gap-0.5 sm:gap-1",
              compactNav ? "xl:hidden" : "lg:hidden",
            )}
          >
            <LanguageSelector variant="header" />
            <ThemeToggle size="icon" />
            <ConnectWalletButton
              size="sm"
              compact
              className="min-w-0 shrink"
              onBeforeConnect={() => setOpen(false)}
            />
            <button
              type="button"
              className="shrink-0 rounded-md p-2 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
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
        <div
          className={cn(
            "border-t border-border-subtle bg-bg-elevated",
            compactNav ? "xl:hidden" : "lg:hidden",
          )}
        >
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
            <div className="mt-3 border-t border-border-subtle pt-4">
              <Button asChild variant="outline" size="md" className="w-full">
                <Link href="/dashboard" onClick={() => setOpen(false)}>
                  {t("nav.openDashboard")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
