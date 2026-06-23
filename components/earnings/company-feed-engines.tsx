"use client";

import * as React from "react";
import { useBotFeedEngine, useBotStore } from "@/lib/bot/store";
import {
  useLiquidationFeedEngine,
  useLiquidationStore,
} from "@/lib/liquidation-engine/store";
import { syncEngineProfitCadences } from "@/lib/company-tools/engine-profit-store";

/** Runs bot + liquidation feed engines once for the whole dashboard shell. */
export function CompanyFeedEngines() {
  const botCadence = useBotStore((s) => s.cadence);
  const liqCadence = useLiquidationStore((s) => s.cadence);

  useBotFeedEngine();
  useLiquidationFeedEngine();

  React.useEffect(() => {
    syncEngineProfitCadences(botCadence, liqCadence);
  }, [botCadence, liqCadence]);

  return null;
}
