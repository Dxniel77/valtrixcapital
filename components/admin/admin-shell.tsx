"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Network,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Calendar,
  Gauge,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminMovementBridge } from "@/components/admin/admin-movement-bridge";
import { AdminNotificationBridge } from "@/components/admin/admin-notification-bridge";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { useAdminSeed, useAdminStore } from "@/lib/admin/store";
import { useBackendAvailable } from "@/lib/hooks/use-backend-sync";
import { useAdminUsersSync } from "@/lib/hooks/use-admin-users-sync";
import { usePlatformConfigSync } from "@/lib/hooks/use-platform-config-sync";
import { useAdminMovementsSync } from "@/lib/hooks/use-admin-movements-sync";
import { useAdminAuditSync } from "@/lib/hooks/use-admin-audit-sync";
import { useTreasurySync } from "@/lib/hooks/use-treasury-sync";

export const adminNavItems = [
  { href: "/admin", key: "overview", icon: LayoutDashboard },
  { href: "/admin/treasury", key: "treasury", icon: Landmark },
  { href: "/admin/grant", key: "grant", icon: UserPlus },
  { href: "/admin/ib", key: "ib", icon: Gauge },
  { href: "/admin/sponsorship", key: "sponsorship", icon: Calendar },
  { href: "/admin/lookup", key: "lookup", icon: Search },
  { href: "/admin/leaders", key: "leaders", icon: Trophy },
  { href: "/admin/users", key: "users", icon: Users },
  { href: "/admin/movements", key: "movements", icon: Wallet },
  { href: "/admin/notifications", key: "notifications", icon: Bell },
  { href: "/admin/support", key: "support", icon: LifeBuoy },
  { href: "/admin/network", key: "network", icon: Network },
  { href: "/admin/reports", key: "reports", icon: FileSpreadsheet },
  { href: "/admin/settings", key: "settings", icon: Settings },
  { href: "/admin/audit", key: "audit", icon: ClipboardList },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const backend = useBackendAvailable();
  const liveDataSynced = useAdminStore((s) => s.liveDataSynced);
  useAdminSeed();
  useAdminUsersSync();
  usePlatformConfigSync();
  useAdminMovementsSync();
  useAdminAuditSync();
  useTreasurySync();

  return (
    <div className="flex min-h-screen bg-bg-base">
      <AdminMovementBridge />
      <AdminNotificationBridge />
      <aside className="sticky top-0 z-30 hidden h-screen w-[244px] shrink-0 flex-col border-r border-border-subtle bg-bg-elevated md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border-subtle px-4">
          <Logo size="sm" showWordmark={false} />
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-semibold text-text-primary">
              Valtrix
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-danger">
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {adminNavItems.map((it) => {
              const active =
                pathname === it.href ||
                (it.href !== "/admin" && pathname.startsWith(it.href));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-gold/10 text-gold"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-gold" />
                    ) : null}
                    <it.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{t(`admin.nav.${it.key}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border-subtle p-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
            {t("admin.backToApp")}
          </Link>
        </div>
      </aside>

      <AdminMobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        items={adminNavItems}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border-subtle bg-bg-elevated/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size="sm" showWordmark={false} />
            <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-danger">
              Admin
            </span>
          </div>
          <div className="hidden md:block">
            <span className="text-sm text-text-muted">
              {backend && liveDataSynced
                ? t("admin.headerLive")
                : backend
                  ? t("admin.headerSyncing")
                  : t("admin.headerOffline")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector className="hidden sm:inline-flex" />
            <ThemeToggle />
            <NotificationsPanel />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md border border-border-subtle p-2 text-text-secondary md:hidden"
              aria-label={t("admin.mobileNav.open")}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
