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

const LANDING_VIDEO_SRC = "/videos/landing-video.mp4";

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
        </motion.div>
      </div>
    </section>
  );
}
