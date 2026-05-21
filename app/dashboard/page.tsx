"use client";

import * as React from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Coins,
  LineChart,
  Lock,
  Sparkles,
  Trophy,
  Wallet,
} from "lucide-react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { formatCountdown, nextUtcMidnightMs, shortenAddress } from "@/lib/utils";
import { MAX_TRADES_PER_DAY, useDailySummary } from "@/lib/trade/store";

export default function DashboardOverviewPage() {
  const { address, isConnected } = useAccount();
  const [countdown, setCountdown] = React.useState(nextUtcMidnightMs());
  const summary = useDailySummary();

  React.useEffect(() => {
    const id = setInterval(() => setCountdown(nextUtcMidnightMs()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <>
            Welcome back{isConnected && address ? `, ${shortenAddress(address, 4, 4)}` : ""}
          </>
        }
        subtitle="Here's a snapshot of your Valtrix activity today."
        actions={
          <>
            <Button asChild variant="outline" size="md">
              <Link href="/dashboard/portfolio">View portfolio</Link>
            </Button>
            <Button asChild variant="primary" size="md">
              <Link href="/dashboard/trade">
                Start trading <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active Capital"
          value="$12,450.00"
          delta={{ value: 6.2 }}
          icon={Coins}
          accent="gold"
          hint="2 active stakes"
        />
        <StatTile
          label="Today's Yield"
          value={`${(summary.totalRateBps / 100).toFixed(2)}%`}
          delta={{ value: summary.bonusRateBps / 100 }}
          icon={Activity}
          accent="success"
          hint={`${(summary.totalRateBps / 100).toFixed(2)}% / 1.00% cap`}
        />
        <StatTile
          label="Wins Today"
          value={`${summary.wins} / ${MAX_TRADES_PER_DAY}`}
          delta={{ value: summary.bonusRateBps / 100 }}
          icon={Trophy}
          accent="info"
          hint={`Reset in ${formatCountdown(countdown)}`}
        />
        <StatTile
          label="To 200% Cap"
          value="62%"
          icon={Lock}
          accent="silver"
          hint="$7,720 to go"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Yield this week</CardTitle>
              <Badge variant="success">+4.18% week-to-date</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <WeekChart />
            <p className="mt-3 text-xs text-text-muted">
              Daily yield is the sum of the 0.3% base rate and +0.1% per
              winning trade, calculated on your total active capital and
              credited at 00:00 UTC.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <DailyAttemptsCard
            remainingMs={countdown}
            wins={summary.wins}
            losses={summary.losses}
            total={MAX_TRADES_PER_DAY}
          />
          <QuickLinksCard />
        </div>
      </div>

      <RoadmapBanner />
    </div>
  );
}

function DailyAttemptsCard({
  remainingMs,
  wins,
  losses,
  total,
}: {
  remainingMs: number;
  wins: number;
  losses: number;
  total: number;
}) {
  const used = wins + losses;
  const remaining = Math.max(total - used, 0);
  const pct = (used / total) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Daily attempts</CardTitle>
          <Badge variant="gold">+{(wins * 0.1).toFixed(1)}% bonus</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <RingProgress percent={pct} value={`${used}/${total}`} />
          <div className="text-xs text-text-secondary">
            <p>
              <span className="font-mono text-success">{wins}</span> wins ·{" "}
              <span className="font-mono text-danger">{losses}</span> losses
            </p>
            <p className="mt-0.5">
              <span className="font-mono text-text-primary">{remaining}</span> attempts left
            </p>
            <p className="mt-2 text-text-muted">
              Resets in{" "}
              <span className="font-mono text-text-primary">
                {formatCountdown(remainingMs)}
              </span>
            </p>
          </div>
        </div>
        <Button asChild variant="primary" size="md" className="w-full">
          <Link href="/dashboard/trade">
            Use next attempt <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RingProgress({ percent, value }: { percent: number; value: string }) {
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="hsl(228 11% 16%)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="url(#gold-grad)"
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id="gold-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0C75E" />
            <stop offset="100%" stopColor="#D4AF37" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm text-text-primary">
        {value}
      </span>
    </div>
  );
}

function QuickLinksCard() {
  const links = [
    { href: "/dashboard/trade", icon: LineChart, label: "Trade" },
    { href: "/dashboard/bot-trading", icon: Bot, label: "Bot feed" },
    { href: "/dashboard/wallet", icon: Wallet, label: "Wallet" },
    { href: "/dashboard/referrals", icon: Sparkles, label: "Invite" },
  ];
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-2 p-4">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base/60 p-3 text-sm text-text-secondary hover:border-gold/30 hover:text-text-primary"
          >
            <l.icon className="h-4 w-4 text-gold" />
            {l.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function WeekChart() {
  const days = [
    { d: "Mon", v: 0.4 },
    { d: "Tue", v: 0.6 },
    { d: "Wed", v: 0.5 },
    { d: "Thu", v: 0.9 },
    { d: "Fri", v: 0.7 },
    { d: "Sat", v: 0.3 },
    { d: "Sun", v: 0.6 },
  ];
  const max = 1;
  const chartHeight = 176;
  return (
    <div className="grid grid-cols-7 gap-3" style={{ height: chartHeight + 36 }}>
      {days.map((day) => {
        const barH = (day.v / max) * chartHeight;
        return (
          <div
            key={day.d}
            className="flex flex-col items-center justify-end gap-2"
          >
            <div className="relative w-full" style={{ height: chartHeight }}>
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-md bg-gradient-to-t from-gold/20 to-gold/80 transition-[height] duration-500"
                style={{ height: barH }}
              />
              <span
                className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] text-text-secondary"
                style={{ bottom: barH + 4 }}
              >
                {day.v.toFixed(2)}%
              </span>
            </div>
            <span className="text-xs text-text-muted">{day.d}</span>
          </div>
        );
      })}
    </div>
  );
}

function RoadmapBanner() {
  return (
    <div className="rounded-lg border border-gold/30 bg-gradient-to-r from-gold/5 via-transparent to-info/5 p-5">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Week 1 of 6 — Foundation
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            You're seeing the Valtrix Capital shell. Live trading, staking,
            referrals and admin land in the coming weeks.
          </p>
        </div>
        <Button asChild variant="outline" size="md">
          <Link href="/dashboard/portfolio">See roadmap</Link>
        </Button>
      </div>
    </div>
  );
}
