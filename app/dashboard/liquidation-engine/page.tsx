import { redirect } from "next/navigation";

export default function LiquidationEngineRedirectPage() {
  redirect("/dashboard/company-tools?tab=liquidation");
}
