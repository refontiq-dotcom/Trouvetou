import { Hero } from "@/components/landing/hero";
import { AdBanner } from "@/components/landing/ad-banner";
import { HowItWorks } from "@/components/landing/steps";
import { CategoryShowcase } from "@/components/landing/category-showcase";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      {/* Hero pleine largeur */}
      <Hero />

      {/* Pub qui chevauche le bas du hero */}
      <div className="relative z-10 -mt-8 sm:-mt-10">
        <AdBanner />
      </div>

      {/* 3 étapes en colonnes — au-dessus des cards */}
      <HowItWorks />

      {/* Cards catégories */}
      <CategoryShowcase />
    </>
  );
}
