import { PageHeader } from "@/components/dashboard/page-header";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function BotTradingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bot Trading"
        subtitle="Institutional operations mirrored from major exchanges with on-chain references."
      />
      <ComingSoon
        week={4}
        title="Bot trading feed"
        description="A live stream of trading operations the company executes, with BscScan / PolygonScan-verifiable references."
        features={[
          "Real-time operation cards (pair, side, PnL)",
          "Deterministic on-chain hash references",
          "Filter by pair / network / direction",
          "Company stats: today / week / all-time profits",
          "Admin-configurable cadence & volume",
        ]}
      />
    </div>
  );
}
