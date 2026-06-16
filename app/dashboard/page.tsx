import dynamic from "next/dynamic";
import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-overview-skeleton";

const DashboardOverview = dynamic(
  () =>
    import("@/components/dashboard/dashboard-overview").then(
      (mod) => mod.DashboardOverview,
    ),
  { loading: () => <DashboardOverviewSkeleton /> },
);

export default function DashboardOverviewPage() {
  return <DashboardOverview />;
}
