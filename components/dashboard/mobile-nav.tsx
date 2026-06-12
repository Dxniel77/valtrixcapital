"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  LayoutDashboard,
  LineChart,
  Briefcase,
  History,
  Users,
  Wallet,
  User,
  Headphones,
  Layers,
  Sparkles,
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
  { href: "/dashboard/support", key: "support", icon: Headphones },
] as const;

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-border-subtle bg-bg-elevated shadow-elevated">
        <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
          <Logo size="sm" showWordmark />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-secondary hover:bg-bg-hover"
            aria-label={t("dashboard.mobileNav.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {navKeys.map((it) => {
              const active =
                pathname === it.href ||
                (it.href !== "/dashboard" && pathname.startsWith(it.href));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      active
                        ? "bg-gold/10 text-gold"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                    )}
                  >
                    <it.icon className="h-[18px] w-[18px]" />
                    {t(`dashboard.nav.${it.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
