"use client";

import * as React from "react";
import { TIMEFRAMES, type Timeframe } from "@/lib/market/pairs";
import { cn } from "@/lib/utils";

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (t: Timeframe) => void;
  className?: string;
}

export function TimeframeSelector({
  value,
  onChange,
  className,
}: TimeframeSelectorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-bg-base/60 p-0.5",
        className,
      )}
      role="group"
      aria-label="Timeframe"
    >
      {TIMEFRAMES.map((tf) => {
        const active = tf.value === value;
        return (
          <button
            key={tf.value}
            type="button"
            onClick={() => onChange(tf.value)}
            className={cn(
              "min-w-[36px] rounded-sm px-2 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-gold/15 text-gold"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            {tf.label}
          </button>
        );
      })}
    </div>
  );
}
