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
import {
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import Link from "next/link";
import { ConnectWalletButton } from "@/components/web3/connect-wallet-button";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

const featureKeys = [
  "web3",
  "markets",
  "quita",
  "yield",
  "network",
  "bot",
  "nonCustodial",
  "withdraw",
] as const;

const featureIcons = {
  web3: Wallet,
  markets: LineChart,
  quita: Layers,
  yield: TrendingUp,
  network: Users,
  bot: Bot,
  nonCustodial: ShieldCheck,
  withdraw: Repeat,
};

const cardGridVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.12 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 280, damping: 24 },
  },
};

const iconVariants: Variants = {
  rest: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.12,
    rotate: -4,
    transition: { type: "spring", stiffness: 400, damping: 14 },
  },
};

function AnimatedCardShell({
  index,
  reducedMotion,
  className,
  children,
}: {
  index: number;
  reducedMotion: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={reducedMotion ? undefined : cardVariants}
      whileHover={
        reducedMotion
          ? undefined
          : { y: -8, scale: 1.02, transition: { duration: 0.22 } }
      }
      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
      animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
      transition={
        reducedMotion
          ? undefined
          : {
              y: {
                duration: 3.2 + index * 0.25,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.18,
              },
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FeatureCard({
  index,
  reducedMotion,
  title,
  desc,
  icon: Icon,
}: {
  index: number;
  reducedMotion: boolean;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <AnimatedCardShell
      index={index}
      reducedMotion={reducedMotion}
      className="group cursor-pointer rounded-lg border border-border-subtle bg-bg-elevated p-5 shadow-card transition-colors hover:border-gold/30"
    >
      <motion.div
        variants={iconVariants}
        initial="rest"
        whileHover={reducedMotion ? undefined : "hover"}
        className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border-subtle bg-bg-hover text-gold transition-colors group-hover:bg-gold/10"
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{desc}</p>
    </AnimatedCardShell>
  );
}

function HowStepCard({
  index,
  reducedMotion,
  stepNumber,
  title,
  desc,
  icon: Icon,
}: {
  index: number;
  reducedMotion: boolean;
  stepNumber: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <AnimatedCardShell
      index={index}
      reducedMotion={reducedMotion}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated p-6 shadow-card transition-colors hover:border-gold/30"
    >
      <span className="absolute right-5 top-5 font-mono text-xs text-text-muted">
        {stepNumber}
      </span>
      <motion.div
        variants={iconVariants}
        initial="rest"
        whileHover={reducedMotion ? undefined : "hover"}
        className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gold-gradient text-text-inverse"
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{desc}</p>
    </AnimatedCardShell>
  );
}

export function FeaturesSection() {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();

  return (
    <section id="features" className="container py-24">
      <SectionHead
        eyebrow={t("features.eyebrow")}
        title={
          <>
            {t("features.title")}{" "}
            <br className="hidden md:block" />
            <span className="text-gradient-gold">{t("features.titleGold")}</span>
          </>
        }
        subtitle={t("features.subtitle")}
      />
      <motion.div
        className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={reducedMotion ? undefined : cardGridVariants}
        initial={reducedMotion ? false : "hidden"}
        whileInView={reducedMotion ? undefined : "show"}
        viewport={{ once: true, amount: 0.15 }}
      >
        {featureKeys.map((key, i) => {
          const Icon = featureIcons[key];
          return (
            <FeatureCard
              key={key}
              index={i}
              reducedMotion={!!reducedMotion}
              title={t(`features.items.${key}.title`)}
              desc={t(`features.items.${key}.desc`)}
              icon={Icon}
            />
          );
        })}
      </motion.div>
    </section>
  );
}

export function HowItWorksSection() {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const steps = [
    { n: "01", icon: Wallet, key: "1" },
    { n: "02", icon: Coins, key: "2" },
    { n: "03", icon: LineChart, key: "3" },
    { n: "04", icon: TrendingUp, key: "4" },
  ] as const;

  return (
    <section id="how" className="container py-24">
      <SectionHead
        eyebrow={t("how.eyebrow")}
        title={
          <>
            {t("how.title")}{" "}
            <span className="text-gradient-gold">{t("how.titleGold")}</span>{" "}
            {t("how.titleEnd")}
          </>
        }
        subtitle={t("how.subtitle")}
      />
      <motion.div
        className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4"
        variants={reducedMotion ? undefined : cardGridVariants}
        initial={reducedMotion ? false : "hidden"}
        whileInView={reducedMotion ? undefined : "show"}
        viewport={{ once: true, amount: 0.15 }}
      >
        {steps.map((s, i) => (
          <HowStepCard
            key={s.n}
            index={i}
            reducedMotion={!!reducedMotion}
            stepNumber={s.n}
            title={t(`how.steps.${s.key}.title`)}
            desc={t(`how.steps.${s.key}.desc`)}
            icon={s.icon}
          />
        ))}
      </motion.div>
    </section>
  );
}

export function YieldModelSection() {
  const { t } = useI18n();

  return (
    <section id="yield" className="container py-24">
      <SectionHead
        eyebrow={t("yield.eyebrow")}
        title={
          <>
            <span className="text-gradient-silver">{t("yield.titleSilver")}</span>{" "}
            <span className="text-gradient-gold">{t("yield.titleGold")}</span>
          </>
        }
        subtitle={t("yield.subtitle")}
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        <div className="surface-card lg:col-span-2 p-6">
          <h3 className="text-base font-semibold text-text-primary">
            {t("yield.tableTitle")}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {t("yield.tableSubtitle")}
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-text-muted">
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-4 font-medium">{t("yield.colWins")}</th>
                  <th className="py-2 pr-4 font-medium">{t("yield.colBase")}</th>
                  <th className="py-2 pr-4 font-medium">{t("yield.colBonus")}</th>
                  <th className="py-2 pr-4 font-medium">{t("yield.colTotal")}</th>
                  <th className="py-2 font-medium">{t("yield.colOn10k")}</th>
                </tr>
              </thead>
              <tbody className="font-mono text-text-primary">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((w) => {
                  const total = 0.3 + w * 0.1;
                  return (
                    <tr key={w} className="border-b border-border-subtle/60">
                      <td className="py-2.5 pr-4">{w} / 8</td>
                      <td className="py-2.5 pr-4">0.3%</td>
                      <td className="py-2.5 pr-4 text-gold">
                        +{(w * 0.1).toFixed(1)}%
                      </td>
                      <td
                        className={`py-2.5 pr-4 ${total >= 1 ? "text-success" : "text-text-primary"}`}
                      >
                        {total.toFixed(1)}%
                      </td>
                      <td className="py-2.5">
                        ${((10000 * total) / 100).toFixed(2)}
                      </td>
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
            title={t("yield.rules.cap.title")}
            desc={t("yield.rules.cap.desc")}
          />
          <RuleCard
            icon={Repeat}
            title={t("yield.rules.reset.title")}
            desc={t("yield.rules.reset.desc")}
          />
          <RuleCard
            icon={Coins}
            title={t("yield.rules.withdraw.title")}
            desc={t("yield.rules.withdraw.desc")}
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
  const { t } = useI18n();
  const tiers = [
    { lvl: 1, pct: 7 },
    { lvl: 2, pct: 3 },
    { lvl: 3, pct: 2 },
    { lvl: 4, pct: 1 },
    { lvl: 5, pct: 1 },
    { lvl: 6, pct: 0.5 },
    { lvl: 7, pct: 0.5 },
    { lvl: 8, pct: 0.25 },
  ];

  return (
    <section id="referrals" className="container py-24">
      <SectionHead
        eyebrow={t("referrals.eyebrow")}
        title={
          <>
            {t("referrals.title")}{" "}
            <span className="text-gradient-gold">{t("referrals.titleGold")}</span>{" "}
            {t("referrals.titleEnd")}
          </>
        }
        subtitle={t("referrals.subtitle")}
      />
      <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h3 className="text-base font-semibold text-text-primary">
            {t("referrals.tiersTitle")}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {t("referrals.tiersSubtitle")}
          </p>
          <ul className="mt-4 divide-y divide-border-subtle">
            {tiers.map((tier) => (
              <li
                key={tier.lvl}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-text-secondary">
                  {t("referrals.level", { n: tier.lvl })}
                </span>
                <span className="font-mono text-gold">{tier.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-2xl font-semibold text-text-primary">
            {t("referrals.leverageTitle")}{" "}
            <span className="text-gradient-gold">
              {t("referrals.leverageGold")}
            </span>
            .
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {t("referrals.leverageDesc")}
          </p>
          <ul className="mt-6 space-y-2 text-sm text-text-secondary">
            {(["link", "tree", "ledger", "rates"] as const).map((key) => (
              <li key={key} className="flex gap-2">
                <span className="text-gold">→</span>
                {t(`referrals.bullets.${key}`)}
              </li>
            ))}
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
  const { t } = useI18n();

  return (
    <section className="container py-24">
      <div className="relative overflow-hidden rounded-xl border border-gold/30 bg-bg-elevated p-10 text-center shadow-elevated md:p-14">
        <div className="absolute inset-0 -z-10 bg-hero-radial opacity-80" />
        <div className="absolute inset-0 -z-10 grid-bg opacity-40" />
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="text-gradient-silver">{t("cta.titleSilver")}</span>{" "}
          <span className="text-gradient-gold">{t("cta.titleGold")}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text-secondary md:text-base">
          {t("cta.subtitle")}
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ConnectWalletButton size="lg" />
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">{t("cta.exploreDashboard")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
