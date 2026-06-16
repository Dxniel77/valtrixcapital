"use client";

import { useAdminBalanceSync } from "@/lib/hooks/use-admin-balance-sync";

/** Global bridge: applies admin balance bonuses/debits to the connected wallet. */
export function AdminBalanceSync() {
  useAdminBalanceSync();
  return null;
}
