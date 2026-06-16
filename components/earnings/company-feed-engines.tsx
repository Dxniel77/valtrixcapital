"use client";

import { useBotFeedEngine } from "@/lib/bot/store";
import { useLiquidationFeedEngine } from "@/lib/liquidation-engine/store";

/** Runs bot + liquidation feed engines once for the whole dashboard shell. */
export function CompanyFeedEngines() {
  useBotFeedEngine();
  useLiquidationFeedEngine();
  return null;
}
