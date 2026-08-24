import { Hero } from "@/components/landing/hero";
import { AdBanner } from "@/components/landing/ad-banner";
import { CategoryTabs } from "@/components/landing/category-tabs";
import { HowItWorks } from "@/components/landing/steps";
import { CtaBand } from "@/components/landing/cta-band";

export default function HomePage() {
  return (
    <>
      <AdBanner />
      <Hero />
      <CategoryTabs />
      <HowItWorks />
      <CtaBand />
    </>
  );
}
