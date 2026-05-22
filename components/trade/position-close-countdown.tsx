"use client";

import * as React from "react";
import {
  resolveTradeOutcome,
  useTradeStore,
  type Position,
} from "@/lib/trade/store";
import { cn } from "@/lib/utils";
import { useClientNow } from "@/lib/hooks/use-client-now";
import { useI18n } from "@/lib/i18n/context";

const CLOSE_WINDOW_SEC = 10;
const CLOSED_FLASH_MS = 2000;

interface PositionCloseCountdownProps {
  pairSymbol: string;
  livePrice: number | null;
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

function outcomeForPosition(
  position: Position | undefined,
  livePrice: number | null,
): "WIN" | "LOSS" | null {
  if (!position) return null;
  if (position.status === "WIN" || position.status === "LOSS") {
    return position.status;
  }
  if (livePrice !== null && livePrice > 0) {
    return resolveTradeOutcome(position, livePrice);
  }
  if (typeof position.exitPrice === "number" && position.exitPrice > 0) {
    return resolveTradeOutcome(position, position.exitPrice);
  }
  return null;
}

export function PositionCloseCountdown({
  pairSymbol,
  livePrice,
}: PositionCloseCountdownProps) {
  const { t } = useI18n();
  const positions = useTradeStore((s) => s.positions);
  const open = React.useMemo(
    () => positions.filter((p) => p.status === "OPEN"),
    [positions],
  );

  const now = useClientNow(200);
  const [resultFlash, setResultFlash] = React.useState(false);
  const [closedPositionId, setClosedPositionId] = React.useState<string | null>(
    null,
  );
  const trackedIdRef = React.useRef<string | null>(null);

  const urgent =
    now !== null ? urgentOpenForPair(open, pairSymbol, now) : null;
  const remainingSec = urgent
    ? Math.max(0, Math.ceil(urgent.remainingMs / 1000))
    : null;

  const closedPosition = closedPositionId
    ? positions.find((p) => p.id === closedPositionId)
    : undefined;

  const activePosition = urgent?.position ?? closedPosition;
  const outcome = outcomeForPosition(activePosition, livePrice);

  React.useEffect(() => {
    if (urgent) {
      trackedIdRef.current = urgent.position.id;
      setResultFlash(false);
      setClosedPositionId(null);
      return;
    }
    if (trackedIdRef.current) {
      const id = trackedIdRef.current;
      trackedIdRef.current = null;
      setClosedPositionId(id);
      setResultFlash(true);
      const timer = setTimeout(() => {
        setResultFlash(false);
        setClosedPositionId(null);
      }, CLOSED_FLASH_MS);
      return () => clearTimeout(timer);
    }
  }, [urgent?.position.id]);

  const showCountdown =
    urgent !== null && remainingSec !== null && remainingSec > 0;
  const showResult =
    outcome !== null &&
    (resultFlash || (urgent !== null && remainingSec === 0));

  if (now === null || (!showCountdown && !showResult)) return null;

  const countdownDigit =
    remainingSec !== null && remainingSec > 0
      ? Math.max(1, remainingSec - 1)
      : null;

  const isWin = outcome === "WIN";
  const label = showResult
    ? isWin
      ? t("common.win")
      : t("common.loss")
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
          showResult && (isWin ? "text-success" : "text-danger"),
        )}
      >
        <span
          className={cn(
            "font-mono font-bold tabular-nums tracking-tight",
            showResult
              ? "text-4xl uppercase sm:text-5xl"
              : "text-7xl sm:text-8xl md:text-9xl text-text-primary",
          )}
        >
          {label}
        </span>
        {!showResult && (
          <span className="mt-2 text-xs font-medium uppercase tracking-widest text-text-secondary">
            {t("trade.closingIn")}
          </span>
        )}
      </div>
    </div>
  );
}
