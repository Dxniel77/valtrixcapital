import * as React from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Admin2FAGate } from "@/components/admin/admin-2fa-gate";
import { readSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/sign-in?next=/admin");
  }

  return (
    <Admin2FAGate>
      <AdminShell>{children}</AdminShell>
    </Admin2FAGate>
  );
}
