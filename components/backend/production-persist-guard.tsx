"use client";

import * as React from "react";
import { purgeDemoFinancialLocalStorage } from "@/lib/persist/production-guard";

/** Clears legacy demo localStorage once on production boot. */
export function ProductionPersistGuard() {
  React.useLayoutEffect(() => {
    purgeDemoFinancialLocalStorage();
  }, []);
  return null;
}
