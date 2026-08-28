"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  Briefcase,
  History,
  Users,
  User,
  Headphones,
  ChevronLeft,
  Layers,
  Sparkles,
  Wallet,
  Newspaper,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

const navKeys = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/company-tools", key: "companyTools", icon: Layers },
  { href: "/dashboard/trade", key: "trade", icon: LineChart },
  { href: "/dashboard/portfolio", key: "portfolio", icon: Briefcase },
  { href: "/dashboard/history", key: "history", icon: History },
  { href: "/dashboard/referrals", key: "referrals", icon: Users },
  { href: "/dashboard/share", key: "share", icon: Sparkles },
  { href: "/dashboard/wallet", key: "wallet", icon: Wallet },
  { href: "/dashboard/profile", key: "profile", icon: User },
  { href: "/dashboard/news", key: "news", icon: Newspaper },
  { href: "/dashboard/support", key: "support", icon: Headphones },
] as const;

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border-subtle bg-bg-elevated transition-[width] md:flex",
        collapsed ? "w-[72px]" : "w-[244px]",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
        {collapsed ? (
          <Logo className="flex" size="sm" showWordmark={false} />
        ) : (
          <Logo className="flex" size="sm" showWordmark />
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            collapsed ? t("dashboard.sidebar.expand") : t("dashboard.sidebar.collapse")
          }
          className="rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180",
            )}
          />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {navKeys.map((it) => {
            const active =
              pathname === it.href ||
              (it.href !== "/dashboard" && pathname.startsWith(it.href));
            const label = t(`dashboard.nav.${it.key}`);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-gold/10 text-gold"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                    collapsed && "justify-center",
                  )}
                  title={collapsed ? label : undefined}
                >
                  {active ? (
                    <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-gold" />
                  ) : null}
                  <it.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed ? <span>{label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!collapsed ? (
        <div className="m-3 rounded-lg border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-3 text-xs">
          <div className="mb-1 inline-flex items-center gap-1.5 text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-medium">{t("dashboard.sidebar.proTip")}</span>
          </div>
          <p className="text-text-secondary">{t("dashboard.sidebar.proTipText")}</p>
        </div>
      ) : null}
    </aside>
  );
}
