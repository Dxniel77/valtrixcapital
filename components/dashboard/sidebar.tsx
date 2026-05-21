"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  LineChart,
  Briefcase,
  History,
  Users,
  Wallet,
  User,
  Headphones,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/bot-trading", label: "Bot Trading", icon: Bot },
  { href: "/dashboard/trade", label: "Trade", icon: LineChart },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/support", label: "Support", icon: Headphones },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border-subtle bg-bg-elevated transition-[width] md:flex",
        collapsed ? "w-[72px]" : "w-[244px]",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
        {collapsed ? (
          <Logo size="sm" showWordmark={false} />
        ) : (
          <Logo size="sm" showWordmark />
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
          {items.map((it) => {
            const active =
              pathname === it.href ||
              (it.href !== "/dashboard" && pathname.startsWith(it.href));
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
                  title={collapsed ? it.label : undefined}
                >
                  {active ? (
                    <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-gold" />
                  ) : null}
                  <it.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed ? <span>{it.label}</span> : null}
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
            <span className="font-medium">Pro tip</span>
          </div>
          <p className="text-text-secondary">
            Win all 7 trades today to hit the 1% daily cap.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
