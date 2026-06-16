"use client";

import * as React from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UsernameGate } from "@/components/user/username-gate";
import { CompanyFeedEngines } from "@/components/earnings/company-feed-engines";
import { EarningsEngines } from "@/components/earnings/earnings-engines";
import { NotificationBridge } from "@/components/notifications/notification-bridge";
import { useAdminUserSync } from "@/lib/hooks/use-admin-user-sync";

function DashboardRuntime() {
  useAdminUserSync();
  return (
    <>
      <EarningsEngines />
      <CompanyFeedEngines />
      <NotificationBridge />
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <UsernameGate>
      <DashboardRuntime />
      <div className="flex min-h-screen bg-bg-base">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
        <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader onOpenMobileNav={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </UsernameGate>
  );
}
