import { PageHeader } from "@/components/dashboard/page-header";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle="Your active stakes, accrued yield and progress to the 200% cap."
      />
      <ComingSoon
        week={3}
        title="Staking and yield engine"
        description="Deposit on BSC or Polygon, stack stakes into one active capital base, watch daily yield accrue."
        features={[
          "USDT BEP20 + USDT Polygon deposits",
          "Multiple stakes summed into total capital",
          "Daily 0.3% base + bonus accrual",
          "200% payout cap progress tracker",
          "Stake history & status timeline",
        ]}
      />
    </div>
  );
}
