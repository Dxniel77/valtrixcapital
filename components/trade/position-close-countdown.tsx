"use client";

import * as React from "react";
import { useTradeStore, type Position } from "@/lib/trade/store";
import { cn } from "@/lib/utils";
import { useClientNow } from "@/lib/hooks/use-client-now";
import { useI18n } from "@/lib/i18n/context";

const CLOSE_WINDOW_SEC = 10;
const CLOSED_FLASH_MS = 2000;

interface PositionCloseCountdownProps {
  pairSymbol: string;
}

function urgentOpenForPair(open: Position[], pairSymbol: string, now: number) {
  let best: { position: Position; remainingMs: number } | null = null;
  for (const p of open) {
    if (p.pair !== pairSymbol) continue;
    const remainingMs = p.openedAt + p.durationSec * 1000 - now;
    if (remainingMs > CLOSE_WINDOW_SEC * 1000) continue;
    if (!best || remainingMs < best.remainingMs) {
      best = { position: p, remainingMs };
    }
  }
  return best;
}

export function PositionCloseCountdown({ pairSymbol }: PositionCloseCountdownProps) {
  const { t } = useI18n();
  const positions = useTradeStore((s) => s.positions);
  const open = React.useMemo(
    () => positions.filter((p) => p.status === "OPEN"),
    [positions],
  );

  const now = useClientNow(200);
  const [closedFlash, setClosedFlash] = React.useState(false);
  const trackedIdRef = React.useRef<string | null>(null);

  const urgent =
    now !== null ? urgentOpenForPair(open, pairSymbol, now) : null;
  const remainingSec = urgent
    ? Math.max(0, Math.ceil(urgent.remainingMs / 1000))
    : null;

  React.useEffect(() => {
    if (urgent) {
      trackedIdRef.current = urgent.position.id;
      setClosedFlash(false);
      return;
    }
    if (trackedIdRef.current) {
      trackedIdRef.current = null;
      setClosedFlash(true);
      const id = setTimeout(() => setClosedFlash(false), CLOSED_FLASH_MS);
      return () => clearTimeout(id);
    }
  }, [urgent?.position.id]);

  const showCountdown =
    urgent !== null && remainingSec !== null && remainingSec > 0;
  const showClosed = closedFlash || (urgent !== null && remainingSec === 0);

  if (now === null || (!showCountdown && !showClosed)) return null;

  const countdownDigit =
    remainingSec !== null && remainingSec > 0
      ? Math.max(1, remainingSec - 1)
      : null;

  const label = showClosed
    ? t("trade.positionClosed")
    : String(countdownDigit);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-bg-base/50 backdrop-blur-[2px]"
      aria-live="assertive"
      role="status"
    >
      <div
        key={label}
        className={cn(
          "animate-in fade-in zoom-in-90 flex flex-col items-center duration-200",
          showClosed ? "text-gold-bright" : "text-text-primary",
        )}
      >
        <span
          className={cn(
            "font-mono font-bold tabular-nums tracking-tight",
            showClosed
              ? "text-4xl uppercase sm:text-5xl"
              : "text-7xl sm:text-8xl md:text-9xl",
          )}
        >
          {label}
        </span>
        {!showClosed && (
          <span className="mt-2 text-xs font-medium uppercase tracking-widest text-text-secondary">
            {t("trade.closingIn")}
          </span>
        )}
      </div>
    </div>
  );
}
