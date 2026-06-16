"use client";

import { EarningsEngines } from "@/components/earnings/earnings-engines";
import { CompanyFeedEngines } from "@/components/earnings/company-feed-engines";
import { AdminMovementBridge } from "@/components/admin/admin-movement-bridge";
import { NotificationBridge } from "@/components/notifications/notification-bridge";
import { useAdminUserSync } from "@/lib/hooks/use-admin-user-sync";
import { useDeferredMount } from "@/lib/hooks/use-deferred-mount";

function DashboardRuntime() {
  useAdminUserSync();
  return (
    <>
      <EarningsEngines />
      <CompanyFeedEngines />
      <AdminMovementBridge />
      <NotificationBridge />
    </>
  );
}

/** Background schedulers — deferred so dashboard shell paints first. */
export function DeferredDashboardRuntime() {
  const ready = useDeferredMount(1200);
  if (!ready) return null;
  return <DashboardRuntime />;
}
