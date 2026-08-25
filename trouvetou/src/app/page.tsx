import { Hero } from "@/components/landing/hero";
import { AdBanner } from "@/components/landing/ad-banner";
import { CategoryTabs } from "@/components/landing/category-tabs";
import { CategoryShowcase } from "@/components/landing/category-showcase";
import { HowItWorks } from "@/components/landing/steps";
import { AlertSubscribe } from "@/components/alerts/alert-subscribe";
import { CtaBand } from "@/components/landing/cta-band";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      {/* Hero pleine largeur — fond bleu edge-to-edge */}
      <Hero />

      {/* Pub + Onglets qui chevauchent le bas du hero */}
      <div className="relative z-10 -mt-8 sm:-mt-10">
        <AdBanner />
        <CategoryTabs />
      </div>

      {/* Contenu normal */}
      <CategoryShowcase />
      <HowItWorks />
      <AlertSubscribe />
      <CtaBand />
    </>
  );
}
