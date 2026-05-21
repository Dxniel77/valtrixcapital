import * as React from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  delta?: { value: number; suffix?: string };
  icon?: LucideIcon;
  hint?: string;
  accent?: "gold" | "silver" | "success" | "danger" | "info" | "default";
  className?: string;
}

const accentMap: Record<NonNullable<StatTileProps["accent"]>, string> = {
  gold: "from-gold/30 to-transparent",
  silver: "from-silver/30 to-transparent",
  success: "from-success/30 to-transparent",
  danger: "from-danger/30 to-transparent",
  info: "from-info/30 to-transparent",
  default: "from-transparent to-transparent",
};

export function StatTile({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  accent = "default",
  className,
}: StatTileProps) {
  const isUp = (delta?.value ?? 0) >= 0;
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated p-5 shadow-card transition-colors hover:border-border-strong",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          accentMap[accent],
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-text-muted">
            {label}
          </p>
          <p className="font-mono text-2xl font-medium text-text-primary">
            {value}
          </p>
        </div>
        {Icon ? (
          <div className="rounded-md border border-border-subtle bg-bg-hover p-2 text-text-secondary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5",
              isUp
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            )}
          >
            {isUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta.value).toFixed(2)}
            {delta.suffix ?? "%"}
          </span>
        ) : (
          <span />
        )}
        {hint ? (
          <span className="text-text-muted">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
