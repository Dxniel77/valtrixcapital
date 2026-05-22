"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { useI18n } from "@/lib/i18n/context";

export function MarketingFooter() {
  const { t } = useI18n();

  const cols = [
    {
      title: t("footer.platform"),
      links: [
        { href: "/dashboard", label: t("dashboard.nav.dashboard") },
        { href: "/dashboard/trade", label: t("dashboard.nav.trade") },
        { href: "/dashboard/portfolio", label: t("dashboard.nav.portfolio") },
        { href: "/dashboard/referrals", label: t("dashboard.nav.referrals") },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { href: "/#how", label: t("footer.how") },
        { href: "/#yield", label: t("footer.yield") },
        { href: "/docs", label: t("footer.docs") },
        { href: "/support", label: t("footer.support") },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { href: "/terms", label: t("footer.terms") },
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/risk", label: t("footer.risk") },
      ],
    },
  ];

  return (
    <footer className="mt-32 border-t border-border-subtle bg-bg-elevated/30">
      <div className="container grid gap-10 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo size="md" showWordmark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
            {t("footer.tagline")}
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {c.title}
            </h4>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-text-secondary transition-colors hover:text-gold"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle">
        <div className="container flex flex-col items-center justify-between gap-2 py-6 text-xs text-text-muted md:flex-row">
          <span>
            © {new Date().getFullYear()} {t("footer.copyright")}
          </span>
          <span className="font-mono">{t("footer.chains")}</span>
        </div>
      </div>
    </footer>
  );
}
