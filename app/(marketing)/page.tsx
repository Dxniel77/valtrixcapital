import { Hero } from "@/components/marketing/hero";
import { MarketTicker } from "@/components/marketing/market-ticker";
import {
  FeaturesSection,
  HowItWorksSection,
  YieldModelSection,
  ReferralsSection,
  CtaSection,
} from "@/components/marketing/sections";

export default function MarketingHomePage() {
  return (
    <>
      <Hero />
      <MarketTicker />
      <FeaturesSection />
      <HowItWorksSection />
      <YieldModelSection />
      <ReferralsSection />
      <CtaSection />
    </>
  );
}
