"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  COPY_TRADING_TABS,
  copyTradingTabActive,
} from "@/lib/admin/copy-trading-tabs";
import { useI18n } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export function CopyTradingAdminNav() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("admin.copyTrading.title")}
      className="flex flex-wrap gap-1 rounded-lg border border-border-subtle bg-bg-elevated p-1"
    >
      {COPY_TRADING_TABS.map((tab) => {
        const active = copyTradingTabActive(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-gold/15 text-gold"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
