import { AdBanner } from "@/components/landing/ad-banner";
import { HowItWorks } from "@/components/landing/steps";
import { CategoryShowcase } from "@/components/landing/category-showcase";

export const revalidate = 60;

/**
 * Accueil.
 *
 * La recherche et les catégories vivent désormais dans le header (fond sombre),
 * conformément à la maquette. Le contenu démarre dans une coquille blanche à
 * coins arrondis qui laisse le fond sombre visible sur les côtés.
 */
export default function HomePage() {
  return (
    <>
      <div className="tt-shell">
        {/* Publicité — modèle distinct de l'annonce (cf. section 14 du brief).
            AdBanner porte déjà son propre padding horizontal. */}
        <AdBanner />

        {/* Étapes et catégories — conservées, migrées visuellement plus tard */}
        <div className="px-4 pb-8 sm:px-6 lg:px-8">
          <HowItWorks />
          <CategoryShowcase />
        </div>
      </div>
    </>
  );
}
