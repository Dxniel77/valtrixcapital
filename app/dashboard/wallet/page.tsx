import { PageHeader } from "@/components/dashboard/page-header";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        subtitle="Deposit USDT, withdraw earnings on BSC or Polygon."
      />
      <ComingSoon
        week={5}
        title="Wallet, deposits & withdrawals"
        description="Non-custodial deposit detection and admin-reviewed payouts with a flat 3% withdrawal fee."
        features={[
          "Treasury deposit addresses (BSC + Polygon)",
          "Pending → confirmed status tracking",
          "Withdrawal flow with 3% fee preview",
          "Min 10 USDT withdrawal, max 100,000 USDT stake",
          "Full on-chain audit trail",
        ]}
      />
    </div>
  );
}
