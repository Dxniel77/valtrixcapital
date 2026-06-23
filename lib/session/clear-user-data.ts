"use client";

import { useStakingStore } from "@/lib/staking/store";
import { useTradeStore } from "@/lib/trade/store";
import { useWalletStore } from "@/lib/wallet/store";
import { useReferralsStore } from "@/lib/referrals/store";
import { useBotStore } from "@/lib/bot/store";
import { useLiquidationStore } from "@/lib/liquidation-engine/store";
import { useNotificationsStore } from "@/lib/notifications/store";

/** Wipes persisted client-side portfolio, trades, wallet, and referral state. */
export function clearUserSessionData(): void {
  useStakingStore.getState().reset();
  useTradeStore.getState().reset();
  useWalletStore.getState().reset();
  useReferralsStore.getState().reset();
  useBotStore.getState().reset();
  useLiquidationStore.getState().reset();
  useNotificationsStore.setState({ items: [] });
}
