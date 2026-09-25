import { Hero } from "@/components/landing/hero";
import { AdBanner } from "@/components/landing/ad-banner";
import { HowItWorks } from "@/components/landing/steps";
import { CategoryShowcase } from "@/components/landing/category-showcase";
import { HomeMobile } from "@/components/landing/home-mobile";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <div className="hidden md:block">
        <Hero />
        <div className="relative z-10 -mt-8 sm:-mt-10">
          <AdBanner />
        </div>
        <HowItWorks />
        <CategoryShowcase />
      </div>
      <HomeMobile />
    </>
  );
}
