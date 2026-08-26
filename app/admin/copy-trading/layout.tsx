import type { ReactNode } from "react";
import { CopyTradingAdminNav } from "@/components/admin/copy-trading-nav";

export default function AdminCopyTradingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <CopyTradingAdminNav />
      {children}
    </div>
  );
}
