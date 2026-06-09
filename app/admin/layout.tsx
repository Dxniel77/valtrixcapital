import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Admin2FAGate } from "@/components/admin/admin-2fa-gate";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Admin2FAGate>
      <AdminShell>{children}</AdminShell>
    </Admin2FAGate>
  );
}
