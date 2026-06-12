"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { useI18n } from "@/lib/i18n/context";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.08 } },
};

const LANDING_VIDEO_SRC = "/videos/landing%20video.mp4";

const VIDEO_TOP_MASK =
  "linear-gradient(to bottom, #000 0px, #000 5rem, transparent 6.5rem)";

const videoClass =
  "pointer-events-none absolute inset-0 h-full w-full object-cover";

function HeroVideoBackground() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const videoTopBlurRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const play = (el: HTMLVideoElement | null) => {
      el?.play().catch(() => {});
    };
    play(videoRef.current);
    play(videoTopBlurRef.current);
  }, []);

  const source = <source src={LANDING_VIDEO_SRC} type="video/mp4" />;

  return (
    <>
      {/* Sharp video — full frame */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={videoClass}
        aria-hidden
      >
        {source}
      </video>
      {/* Blur applied on the video itself, masked to the header band */}
      <video
        ref={videoTopBlurRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={`${videoClass} scale-[1.03] blur-[3px]`}
        style={{
          maskImage: VIDEO_TOP_MASK,
          WebkitMaskImage: VIDEO_TOP_MASK,
        }}
        aria-hidden
      >
        {source}
      </video>
      {/* Fixed dark scrim — same as original dark theme; not tied to light bg-base */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(240_14%_5%_/0.75)] via-[hsl(240_14%_5%_/0.45)] to-[hsl(240_14%_5%_/0.85)]"
        aria-hidden
      />
    </>
  );
}

export function Hero() {
  const { t } = useI18n();

  return (
    <section className="hero-over-video relative -mt-20 min-h-screen overflow-hidden pt-20">
      <div className="absolute inset-0 z-0">
        <HeroVideoBackground />
      </div>

      <div className="container relative z-10 pb-24 pt-12 lg:pt-20">
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-xs text-gold">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-pulse-soft" />
              {t("hero.badge")}
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl"
          >
            <span className="text-gradient-silver">{t("hero.titleSilver")}</span>{" "}
            <span className="text-gradient-gold">{t("hero.titleGold")}</span>
            <br />
            <span className="text-text-primary">{t("hero.titlePrimary")}</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-text-secondary md:text-lg"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <ConnectWalletButton size="lg" />
            <Button asChild variant="outline" size="lg">
              <Link href="/#how">
                {t("hero.ctaHow")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-muted"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />{" "}
              {t("hero.trustNonCustodial")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-gold" /> {t("hero.trustQuickTrades")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5 text-info" /> {t("hero.trustNetwork")}
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
          {/* <div className="surface-card relative overflow-hidden p-2">
            <HeroDashboardMock />
          </div> */}
        </motion.div>
      </div>
    </section>
  );
}

function HeroDashboardMock() {
  const { t } = useI18n();

  const navItems = [
    { key: "dashboard", active: true },
    { key: "companyTools", active: false },
    { key: "trade", active: false },
    { key: "portfolio", active: false },
    { key: "history", active: false },
    { key: "referrals", active: false },
    { key: "wallet", active: false },
  ] as const;

  const stats = [
    { key: "activeCapital", v: "$12,450", d: "+0.6%", up: true },
    { key: "todayYield", v: "$74.70", d: "+0.6%", up: true },
    { key: "winsToday", v: "3 / 7", d: "+0.3%", up: true },
    { key: "toCap", v: "62%", d: "−", up: true },
  ] as const;

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-bg-base">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="relative flex h-full">
        <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border-subtle bg-bg-elevated/60 p-3 md:flex">
          {navItems.map((i) => (
            <div
              key={i.key}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${
                i.active
                  ? "border-l-2 border-gold bg-gold/10 text-gold"
                  : "text-text-secondary"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              {t(`hero.mockNav.${i.key}`)}
            </div>
          ))}
        </div>

        <div className="flex-1 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.key}
                className="rounded-md border border-border-subtle bg-bg-elevated/60 p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  {t(`hero.mockStats.${s.key}`)}
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
                {t("hero.mockTrade.quickTrade")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-success/15 py-2 text-center text-xs text-success">
                  {t("hero.mockTrade.buy")}
                </div>
                <div className="rounded-md bg-danger/15 py-2 text-center text-xs text-danger">
                  {t("hero.mockTrade.sell")}
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-[10px] text-text-secondary">
                <div className="flex justify-between">
                  <span>{t("hero.mockTrade.duration")}</span>
                  <span className="font-mono">1m</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("hero.mockTrade.attempts")}</span>
                  <span className="font-mono">7 / 7</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("hero.mockTrade.bonus")}</span>
                  <span className="font-mono text-gold">+0.0%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FakeCandlesticks() {
  const candles = React.useMemo(
    () => [
      [3, 5], [4, 7], [6, 4], [3, 6], [5, 8], [7, 5], [4, 3],
      [6, 8], [8, 11], [9, 7], [7, 10], [10, 12], [9, 8],
      [11, 14], [12, 10], [10, 13], [13, 15], [11, 9], [12, 14],
      [14, 11], [13, 16], [15, 12], [14, 17], [16, 13], [15, 18],
      [17, 14], [16, 19], [18, 15], [17, 20], [19, 16],
    ],
    [],
  );

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
