"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export function AdminMobileNav({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly {
    href: string;
    key: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}) {
  const { t } = useI18n();
  const pathname = usePathname();

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
      <aside className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col border-r border-border-subtle bg-bg-elevated shadow-xl">
        <div className="flex h-14 items-center justify-between border-b border-border-subtle px-4">
          <span className="font-display text-sm font-semibold">Admin</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-text-muted hover:bg-bg-hover"
            aria-label={t("admin.mobileNav.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {items.map((it) => {
              const active =
                pathname === it.href ||
                (it.href !== "/admin" && pathname.startsWith(it.href));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                      active
                        ? "bg-gold/10 text-gold"
                        : "text-text-secondary hover:bg-bg-hover",
                    )}
                  >
                    <it.icon className="h-[18px] w-[18px]" />
                    {t(`admin.nav.${it.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
