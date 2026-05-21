import { PageHeader } from "@/components/dashboard/page-header";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        subtitle="Build your 7-level network. Only active referrals count."
      />
      <ComingSoon
        week={4}
        title="7-level referral system"
        description="A viral mechanic that accelerates your 200% payout cap with every active downline."
        features={[
          "Personal referral link + QR code",
          "Downline tree by level (1–7)",
          "Per-level commission ledger",
          "Active vs. inactive flagging",
          "Admin-configurable commission rates",
        ]}
      />
    </div>
  );
}
