"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Globe } from "lucide-react";
import { localeOptions, type Locale } from "@/lib/i18n/config";
import { useI18n, useLocaleMeta } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type LanguageSelectorProps = {
  className?: string;
  align?: "start" | "center" | "end";
  /** Header variant shows native name on wide screens */
  variant?: "default" | "header";
};

export function LanguageSelector({
  className,
  align,
  variant = "default",
}: LanguageSelectorProps) {
  const { locale, setLocale, t } = useI18n();
  const { dir, nativeName, regionCode } = useLocaleMeta();
  const [open, setOpen] = React.useState(false);
  const menuAlign = align ?? (dir === "rtl" ? "start" : "end");

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md text-sm text-text-secondary transition-colors",
            variant === "header"
              ? "h-9 px-2 hover:bg-bg-hover hover:text-text-primary data-[state=open]:bg-bg-hover data-[state=open]:text-text-primary"
              : "border border-border-subtle bg-bg-base px-2.5 py-1.5 hover:border-gold/30 hover:text-text-primary data-[state=open]:border-gold/40 data-[state=open]:text-text-primary",
            className,
          )}
          aria-label={t("common.language")}
        >
          <Globe className="h-4 w-4 shrink-0 opacity-80" />
          {variant === "header" ? (
            <>
              <span className="hidden font-medium uppercase tracking-wide sm:inline">
                {regionCode}
              </span>
              <span className="hidden max-w-[7rem] truncate font-medium xl:inline">
                {nativeName}
              </span>
            </>
          ) : (
            <span className="font-medium uppercase tracking-wide">
              {regionCode}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={menuAlign}
          sideOffset={8}
          className={cn(
            "z-50 min-w-[220px] overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated/95 p-1 shadow-xl backdrop-blur-md",
            dir === "rtl" ? "border-l-2 border-l-gold/70" : "border-r-2 border-r-gold/70",
            "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
          )}
        >
          {localeOptions.map((option) => {
            const selected = option.locale === locale;
            return (
              <DropdownMenu.Item
                key={option.locale}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2.5 text-sm outline-none",
                  "focus:bg-bg-hover data-[highlighted]:bg-bg-hover",
                  selected &&
                    "bg-gold/10 text-gold focus:bg-gold/15 data-[highlighted]:bg-gold/15",
                  !selected && "text-text-primary",
                )}
                onSelect={() => setLocale(option.locale as Locale)}
              >
                <span
                  className={cn(
                    "w-7 shrink-0 text-xs font-semibold uppercase tracking-wide",
                    selected ? "text-gold" : "text-text-muted",
                  )}
                >
                  {option.regionCode}
                </span>
                <span className="flex-1 truncate">{option.nativeName}</span>
                {selected ? (
                  <Check className="h-4 w-4 shrink-0 text-gold" />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
