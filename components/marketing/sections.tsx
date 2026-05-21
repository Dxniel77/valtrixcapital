"use client";

import * as React from "react";
import {
  Wallet,
  LineChart,
  Layers,
  Users,
  ShieldCheck,
  Bot,
  Coins,
  Repeat,
  TrendingUp,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";

export function FeaturesSection() {
  const items = [
    {
      icon: Wallet,
      title: "Web3 native",
      desc: "Connect MetaMask, Trust, Rainbow or any WalletConnect-compatible wallet on BNB Chain or Polygon.",
    },
    {
      icon: LineChart,
      title: "Live markets",
      desc: "Real Binance & Bybit candles across BTC, ETH, SOL, XRP, BNB and MATIC. 1m to 1D timeframes.",
    },
    {
      icon: Layers,
      title: "Flexible staking",
      desc: "Stake any amount from $15 to $100,000. Multiple stakes sum into one active capital base.",
    },
    {
      icon: TrendingUp,
      title: "Up to 1% daily",
      desc: "0.3% base + 0.1% per winning trade across your 7 daily attempts. Capped at 1% per day.",
    },
    {
      icon: Users,
      title: "7-level network",
      desc: "Build a downline of active users and accelerate your payout cap with multi-tier commissions.",
    },
    {
      icon: Bot,
      title: "Bot transparency",
      desc: "See institutional operations mirrored from major exchanges with BscScan-verifiable hashes.",
    },
    {
      icon: ShieldCheck,
      title: "Non-custodial",
      desc: "You sign in with your wallet. We never hold your private keys. All on-chain proofs.",
    },
    {
      icon: Repeat,
      title: "Withdraw anytime",
      desc: "Pull profits whenever you want with a flat 3% fee. Settlements on BSC or Polygon.",
    },
  ];

  return (
    <section id="features" className="container py-24">
      <SectionHead
        eyebrow="Platform"
        title={
          <>
            Built for the new generation of <br className="hidden md:block" />
            <span className="text-gradient-gold">on-chain investors</span>
          </>
        }
        subtitle="Every primitive you need to put capital to work — trading, staking, referrals and full transparency in one place."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="group rounded-lg border border-border-subtle bg-bg-elevated p-5 shadow-card transition-colors hover:border-gold/30"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold transition-colors group-hover:bg-gold/10">
              <it.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              {it.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              {it.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      icon: Wallet,
      title: "Connect your wallet",
      desc: "MetaMask, Trust or WalletConnect. Pick BNB Chain or Polygon. We never custody your keys.",
    },
    {
      n: "02",
      icon: Coins,
      title: "Stake your capital",
      desc: "Deposit any amount between $15 and $100,000 in USDT. Add to your stake anytime; balances aggregate.",
    },
    {
      n: "03",
      icon: LineChart,
      title: "Play your 7 daily trades",
      desc: "Choose BTC, ETH, SOL, XRP, BNB or MATIC. Predict UP or DOWN over 1–5 minutes. Each win adds +0.1% to today.",
    },
    {
      n: "04",
      icon: TrendingUp,
      title: "Earn daily, withdraw anytime",
      desc: "Yield is credited at 00:00 UTC. Withdraw profits whenever (3% fee) until your stake doubles (200%).",
    },
  ];

  return (
    <section id="how" className="container py-24">
      <SectionHead
        eyebrow="How it works"
        title={
          <>
            From wallet to <span className="text-gradient-gold">first yield</span> in four steps
          </>
        }
        subtitle="A non-custodial, transparent flow designed for both new and experienced Web3 users."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="relative overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated p-6 shadow-card"
          >
            <span className="absolute right-5 top-5 font-mono text-xs text-text-muted">
              {s.n}
            </span>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gold-gradient text-text-inverse">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {s.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function YieldModelSection() {
  return (
    <section id="yield" className="container py-24">
      <SectionHead
        eyebrow="Yield model"
        title={
          <>
            <span className="text-gradient-silver">Predictable base.</span>{" "}
            <span className="text-gradient-gold">Performance upside.</span>
          </>
        }
        subtitle="Your daily return is deterministic at the base rate and amplifies as you win your daily trades."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-2">
          <h3 className="text-base font-semibold text-text-primary">
            Daily yield = base + bonus per win
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            All calculated on your total locked capital.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-text-muted">
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-4 font-medium">Trades won</th>
                  <th className="py-2 pr-4 font-medium">Bonus</th>
                  <th className="py-2 pr-4 font-medium">Total daily</th>
                  <th className="py-2 font-medium">On $10,000</th>
                </tr>
              </thead>
              <tbody className="font-mono text-text-primary">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((w) => {
                  const total = 0.3 + w * 0.1;
                  return (
                    <tr key={w} className="border-b border-border-subtle/60">
                      <td className="py-2.5 pr-4">{w} / 7</td>
                      <td className="py-2.5 pr-4 text-gold">+{(w * 0.1).toFixed(1)}%</td>
                      <td className={`py-2.5 pr-4 ${total >= 1 ? "text-success" : "text-text-primary"}`}>
                        {total.toFixed(1)}%
                      </td>
                      <td className="py-2.5">${(10000 * total / 100).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <RuleCard
            icon={Lock}
            title="200% payout cap"
            desc="Each active stake doubles once total earnings reach 100% of its principal. Then a new stake re-opens earnings."
          />
          <RuleCard
            icon={Repeat}
            title="24h trade reset"
            desc="The 7 daily trades and bonuses reset every day at 00:00 UTC. Unused attempts do not roll over."
          />
          <RuleCard
            icon={Coins}
            title="Withdraw flow"
            desc="Withdraw your earnings any time. Flat 3% fee. Settles on BSC or Polygon to your connected wallet."
          />
        </div>
      </div>
    </section>
  );
}

function RuleCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5 shadow-card">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold">
        <Icon className="h-4 w-4" />
      </div>
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{desc}</p>
    </div>
  );
}

export function ReferralsSection() {
  const tiers = [
    { lvl: 1, pct: 7 },
    { lvl: 2, pct: 3 },
    { lvl: 3, pct: 2 },
    { lvl: 4, pct: 1 },
    { lvl: 5, pct: 1 },
    { lvl: 6, pct: 0.5 },
    { lvl: 7, pct: 0.5 },
  ];
  return (
    <section id="referrals" className="container py-24">
      <SectionHead
        eyebrow="Network"
        title={
          <>
            A <span className="text-gradient-gold">7-level</span> referral system that compounds
          </>
        }
        subtitle="Only active referrals earn commissions. Commissions accelerate your own 200% payout cap, not subtract from your downline."
      />
      <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h3 className="text-base font-semibold text-text-primary">
            Commission tiers
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Default rates — fully configurable from the admin panel.
          </p>
          <ul className="mt-4 divide-y divide-border-subtle">
            {tiers.map((t) => (
              <li
                key={t.lvl}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-text-secondary">Level {t.lvl}</span>
                <span className="font-mono text-gold">{t.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-text-primary">
            More than rewards — it's <span className="text-gradient-gold">leverage</span>.
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            Every commission your network generates flows into your earnings
            balance, accelerating how quickly you reach your 200% cap and unlock
            a fresh staking cycle. Only <strong className="text-text-primary">active</strong>{" "}
            users count toward your network — keeping the ecosystem healthy and
            real.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-text-secondary">
            <li className="flex gap-2"><span className="text-gold">→</span> Unique referral link + QR code</li>
            <li className="flex gap-2"><span className="text-gold">→</span> Visual downline tree by level</li>
            <li className="flex gap-2"><span className="text-gold">→</span> Real-time commission ledger</li>
            <li className="flex gap-2"><span className="text-gold">→</span> Admin-configurable rates</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-semibold leading-tight md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-text-secondary">
        {subtitle}
      </p>
    </div>
  );
}

export function CtaSection() {
  return (
    <section className="container py-24">
      <div className="relative overflow-hidden rounded-xl border border-gold/30 bg-bg-elevated p-10 text-center shadow-elevated md:p-14">
        <div className="absolute inset-0 -z-10 bg-hero-radial opacity-80" />
        <div className="absolute inset-0 -z-10 grid-bg opacity-40" />
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="text-gradient-silver">Your capital deserves</span>{" "}
          <span className="text-gradient-gold">a better engine.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary md:text-base">
          Connect your wallet and unlock daily yield, live markets and a global
          referral economy — fully on-chain.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ConnectInline />
        </div>
      </div>
    </section>
  );
}

import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function ConnectInline() {
  return (
    <>
      <ConnectWalletButton size="lg" />
      <Button asChild variant="outline" size="lg">
        <Link href="/dashboard">Explore dashboard</Link>
      </Button>
    </>
  );
}
