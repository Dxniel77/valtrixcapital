"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { EarningsEngines } from "@/components/earnings/earnings-engines";
import { CompanyFeedEngines } from "@/components/earnings/company-feed-engines";
import { NotificationBridge } from "@/components/notifications/notification-bridge";
import { BackendUserSync } from "@/components/backend/backend-user-sync";
import { AdminBalanceSync } from "@/components/admin/admin-balance-sync";
import { useAdminUserSync } from "@/lib/hooks/use-admin-user-sync";
import { primeEngineProfitLedgers } from "@/lib/company-tools/engine-profit-store";
import { useDeferredMount } from "@/lib/hooks/use-deferred-mount";

/** Bot/liquidation feeds only run on company-tools — keeps /dashboard boot light. */
function useFeedEnginesRoute(): boolean {
  const pathname = usePathname();
  return pathname.startsWith("/dashboard/company-tools");
}

function LightRuntime() {
  useAdminUserSync();
  return (
    <>
      <BackendUserSync />
      <AdminBalanceSync />
      <EarningsEngines />
      <NotificationBridge />
    </>
  );
}

function FullRuntime() {
  return (
    <>
      <LightRuntime />
      <CompanyFeedEngines />
    </>
  );
}

function DashboardRuntime() {
  const feedRoute = useFeedEnginesRoute();
  React.useEffect(() => {
    if (!feedRoute) return;
    primeEngineProfitLedgers();
  }, [feedRoute]);
  return feedRoute ? <FullRuntime /> : <LightRuntime />;
}

/** Background schedulers — deferred so dashboard shell paints first. */
export function DeferredDashboardRuntime() {
  const ready = useDeferredMount(600);
  if (!ready) return null;
  return <DashboardRuntime />;
}
