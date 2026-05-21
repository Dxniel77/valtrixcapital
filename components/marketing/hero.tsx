"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 grid-bg opacity-60" />
      <div className="absolute inset-x-0 -top-32 -z-10 h-[480px] bg-hero-radial" />

      <div className="container relative pb-24 pt-20 lg:pt-28">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-xs text-gold">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-pulse-soft" />
              Live on BNB Chain & Polygon
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl"
          >
            <span className="text-gradient-silver">Stake on-chain.</span>{" "}
            <span className="text-gradient-gold">Earn up to 1% daily.</span>
            <br />
            <span className="text-text-primary">Trade live markets.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg"
          >
            Valtrix Capital is a Web3-native yield platform. Connect your
            wallet, stake from $15 to $100,000, and amplify your daily return by
            winning your 7 daily trades — plus a 7-level referral network.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <ConnectWalletButton size="lg" />
            <Button asChild variant="outline" size="lg">
              <Link href="/#how">
                How it works <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-muted"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Non-custodial wallet
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-gold" /> 1–5 min quick trades
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5 text-info" /> 7-level network
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div className="absolute -inset-px rounded-xl bg-gold-gradient opacity-30 blur-xl" />
          <div className="surface-card relative overflow-hidden p-2">
            <HeroDashboardMock />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroDashboardMock() {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-bg-base">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="relative flex h-full">
        {/* Mini sidebar */}
        <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border-subtle bg-bg-elevated/60 p-3 md:flex">
          {[
            { label: "Dashboard", active: true },
            { label: "Bot Trading", active: false },
            { label: "Trade", active: false },
            { label: "Portfolio", active: false },
            { label: "History", active: false },
            { label: "Referrals", active: false },
            { label: "Wallet", active: false },
          ].map((i) => (
            <div
              key={i.label}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                i.active
                  ? "border-l-2 border-gold bg-gold/10 text-gold"
                  : "text-text-secondary"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              {i.label}
            </div>
          ))}
        </div>

        {/* Mock dashboard */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { l: "Active Capital", v: "$12,450", d: "+0.6%", up: true },
              { l: "Today's Yield", v: "$74.70", d: "+0.6%", up: true },
              { l: "Wins Today", v: "3 / 7", d: "+0.3%", up: true },
              { l: "To 200% Cap", v: "62%", d: "−", up: true },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-md border border-border-subtle bg-bg-elevated/60 p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  {s.l}
                </p>
                <p className="mt-1 font-mono text-lg text-text-primary">{s.v}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    s.up ? "text-success" : "text-danger"
                  }`}
                >
                  {s.d}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="col-span-2 rounded-md border border-border-subtle bg-bg-elevated/60 p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-mono text-text-primary">BTC/USDT</span>
                <span className="text-success">$67,318.30 +1.25%</span>
              </div>
              <FakeCandlesticks />
            </div>
            <div className="rounded-md border border-border-subtle bg-bg-elevated/60 p-3">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
                Quick Trade
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-success/15 py-2 text-center text-xs text-success">
                  BUY ↑
                </div>
                <div className="rounded-md bg-danger/15 py-2 text-center text-xs text-danger">
                  SELL ↓
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-[10px] text-text-secondary">
                <div className="flex justify-between"><span>Duration</span><span className="font-mono">1m</span></div>
                <div className="flex justify-between"><span>Attempts</span><span className="font-mono">7 / 7</span></div>
                <div className="flex justify-between"><span>Bonus</span><span className="font-mono text-gold">+0.0%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FakeCandlesticks() {
  const candles = React.useMemo(() => {
    const seed = [
      [3, 5], [4, 7], [6, 4], [3, 6], [5, 8], [7, 5], [4, 3],
      [6, 8], [8, 11], [9, 7], [7, 10], [10, 12], [9, 8],
      [11, 14], [12, 10], [10, 13], [13, 15], [11, 9], [12, 14],
      [14, 11], [13, 16], [15, 12], [14, 17], [16, 13], [15, 18],
      [17, 14], [16, 19], [18, 15], [17, 20], [19, 16],
    ];
    return seed;
  }, []);

  return (
    <div className="flex h-24 items-end gap-1">
      {candles.map(([lo, hi], i) => {
        const up = i % 3 !== 0;
        const total = 22;
        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-end"
            style={{ height: "100%" }}
          >
            <div
              className={`w-1 rounded-sm ${up ? "bg-success" : "bg-danger"}`}
              style={{
                height: `${((hi - lo) / total) * 100}%`,
                marginBottom: `${(lo / total) * 100}%`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
