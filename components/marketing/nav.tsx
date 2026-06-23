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
        "sticky top-0 z-50 transition-all supports-[padding:max(0px)]:pt-[max(0px,env(safe-area-inset-top))]",
        scrolled ? "glass border-b border-border-subtle" : "bg-transparent",
      )}
    >
      <div
        className={cn(
          "container flex h-[3.75rem] w-full items-center justify-between gap-3 sm:h-16",
          compactNav
            ? "xl:grid xl:h-[4.5rem] xl:grid-cols-[1fr_auto_1fr] xl:gap-4"
            : "lg:grid lg:h-[4.5rem] lg:grid-cols-[1fr_auto_1fr] lg:gap-4",
        )}
      >
        <div className="flex min-w-0 shrink-0 items-center lg:justify-self-start">
          <Logo
            className={cn(compactNav ? "flex xl:hidden" : "flex lg:hidden")}
            size="sm"
          />
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
            "hidden justify-self-center",
            compactNav ? "xl:block" : "lg:block",
          )}
        >
          <ul
            className={cn(
              "flex items-center justify-center",
              compactNav
                ? "gap-2 xl:gap-3 2xl:gap-5"
                : "gap-3 lg:gap-4 xl:gap-6",
            )}
          >
            {links.map((l) => (
              <li key={l.href} className="shrink-0">
                <Link
                  href={l.href}
                  className={cn(
                    "block whitespace-nowrap font-medium text-text-secondary transition-colors hover:text-text-primary",
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

        {/* Desktop actions */}
        <div
          className={cn(
            "hidden shrink-0 items-center justify-end justify-self-end gap-1.5 sm:gap-2",
            compactNav ? "xl:flex" : "md:flex",
          )}
        >
          <div
            className={cn(
              "flex items-center rounded-lg border border-border-subtle/70 bg-bg-base/50 p-0.5",
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

          <ConnectWalletButton size="lg" compact={compactNav} />
        </div>

        {/* Mobile toolbar */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 sm:gap-2",
            compactNav ? "xl:hidden" : "lg:hidden",
            dir === "rtl" ? "flex-row-reverse" : "flex-row",
          )}
        >
          <div
            className={cn(
              "flex items-center rounded-xl border border-border-subtle/80 bg-bg-base/70 p-0.5 shadow-sm backdrop-blur-sm",
              dir === "rtl" ? "flex-row-reverse" : "flex-row",
            )}
          >
            <LanguageSelector variant="header" iconOnly />
            <ThemeToggle size="icon" className="h-10 w-10 shrink-0" />
          </div>

          <ConnectWalletButton
            iconOnly
            onBeforeConnect={() => setOpen(false)}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-text-secondary hover:text-text-primary"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("nav.toggleMenu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <div
          className={cn(
            "max-h-[calc(100dvh-3.75rem)] overflow-y-auto border-t border-border-subtle bg-bg-elevated/98 backdrop-blur-md sm:max-h-[calc(100dvh-4rem)]",
            compactNav ? "xl:hidden" : "lg:hidden",
          )}
        >
          <div className="container flex flex-col gap-1 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-3 text-base font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary active:bg-bg-hover"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}

            <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
              <ConnectWalletButton
                size="lg"
                className="w-full [&>div]:w-full [&_button]:w-full"
                onBeforeConnect={() => setOpen(false)}
              />
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
