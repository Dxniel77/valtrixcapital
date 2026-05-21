import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LifeBuoy, MessagesSquare, Mail, Telescope } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        subtitle="Reach the Valtrix Capital team. Help center coming Week 6."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SupportCard
          icon={MessagesSquare}
          title="Live chat"
          desc="Talk to a Valtrix team member directly. Avg response < 10 minutes."
          cta="Open chat"
          coming
        />
        <SupportCard
          icon={Mail}
          title="Email"
          desc="Send us a message. We answer within 24 hours."
          cta="support@valtrix.capital"
          href="mailto:support@valtrix.capital"
        />
        <SupportCard
          icon={Telescope}
          title="Docs & guides"
          desc="Tutorials for staking, trading, referrals and withdrawals."
          cta="Browse docs"
          coming
        />
        <SupportCard
          icon={LifeBuoy}
          title="Status & incidents"
          desc="Real-time platform status, planned maintenance and post-mortems."
          cta="View status"
          coming
        />
      </div>
    </div>
  );
}

function SupportCard({
  icon: Icon,
  title,
  desc,
  cta,
  href,
  coming,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  cta: string;
  href?: string;
  coming?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold">
            <Icon className="h-5 w-5" />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">{desc}</p>
        <div className="mt-4">
          {href ? (
            <Button asChild variant="outline" size="sm">
              <a href={href}>{cta}</a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={coming}>
              {coming ? "Coming soon" : cta}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
