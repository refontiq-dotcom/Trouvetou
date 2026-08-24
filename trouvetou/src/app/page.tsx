import { Hero } from "@/components/landing/hero";
import { AdBanner } from "@/components/landing/ad-banner";
import { CategoryTabs } from "@/components/landing/category-tabs";
import { CategoryShowcase } from "@/components/landing/category-showcase";
import { HowItWorks } from "@/components/landing/steps";
import { CtaBand } from "@/components/landing/cta-band";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <AdBanner />
      <Hero />
      <CategoryTabs />
      <CategoryShowcase />
      <HowItWorks />
      <CtaBand />
    </>
  );
}
