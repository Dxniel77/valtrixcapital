"use client";

import * as React from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UsernameGate } from "@/components/user/username-gate";
import { SponsorTermsGate } from "@/components/user/sponsor-terms-gate";
import { UserSessionGuard } from "@/components/auth/user-session-guard";
import { DeferredDashboardRuntime } from "@/components/dashboard/deferred-dashboard-runtime";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <UsernameGate>
      <UserSessionGuard>
        <SponsorTermsGate>
          <DeferredDashboardRuntime />
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
        </SponsorTermsGate>
      </UserSessionGuard>
    </UsernameGate>
  );
}
