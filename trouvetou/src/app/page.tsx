import { Hero } from "@/components/landing/hero";
import { AdBanner } from "@/components/landing/ad-banner";
import { CategoryShowcase } from "@/components/landing/category-showcase";
import { HowItWorks } from "@/components/landing/steps";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      {/* Hero pleine largeur — fond bleu edge-to-edge */}
      <Hero />

      {/* Pub qui chevauche le bas du hero */}
      <div className="relative z-10 -mt-8 sm:-mt-10">
        <AdBanner />
      </div>

      {/* Contenu normal */}
      <CategoryShowcase />
      <HowItWorks />
    </>
  );
}
