import Link from "next/link";
import {
  Building2,
  GraduationCap,
  Stethoscope,
  UtensilsCrossed,
} from "lucide-react";

// ============================================================================
// TROUVETOU — Bloc « Catégories populaires » (colonne desktop)
//
// Les compteurs sont dérivés des annonces RÉELLEMENT AFFICHÉES sur la page
// courante (donc déjà filtrées par recherche / type / budget). Ils ne
// constituent pas un total global de la base : le libellé l'indique
// explicitement pour ne rien laisser croire.
//
// Une catégorie sans annonce n'est pas affichée : afficher « 0 » n'aide pas
// l'utilisateur et gonflerait artificiellement la colonne.
// ============================================================================

export interface PopularCategory {
  slug: string;
  name: string;
  href: string;
  /** Nombre d'annonces disponibles — issu de la base. */
  count: number;
  icon: typeof Stethoscope;
}

const CATEGORY_ICONS: Record<string, typeof Stethoscope> = {
  clinic: Stethoscope,
  school: GraduationCap,
  restaurant: UtensilsCrossed,
  hotel: Building2,
  residence: Building2,
  other: Building2,
};

/** Route du portail correspondant au slug de catégorie. */
const CATEGORY_HREFS: Record<string, string> = {
  clinic: "/cliniques",
  school: "/ecoles",
  restaurant: "/restaurants",
  hotel: "/hotels",
  residence: "/hotels",
  other: "/hotels",
};

interface PopularCategoriesBlockProps {
  /** Catégories lues en base, avec leur nombre d'annonces. */
  categories: PopularCategory[];
}

export function PopularCategoriesBlock({ categories }: PopularCategoriesBlockProps) {
  const visible = categories
    .filter((category) => category.count > 0)
    .slice(0, 6);

  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby="popular-categories-title"
      className="rounded-tt-card bg-tt-card p-4 shadow-tt-card ring-1 ring-tt-line"
    >
      <h3
        id="popular-categories-title"
        className="font-display text-base font-bold text-tt-ink"
      >
        Catégories populaires
      </h3>
      <p className="mt-0.5 text-xs text-tt-ink-60">Dans vos résultats actuels</p>

      <ul className="mt-3 space-y-1">
        {visible.map((category) => {
          const Icon = CATEGORY_ICONS[category.slug] ?? Building2;
          return (
            <li key={category.slug}>
              <Link
                href={CATEGORY_HREFS[category.slug] ?? "/hotels"}
                className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-tt-lime-tint"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tt-lime-soft text-tt-ink"
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-tt-ink">
                  {category.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-tt-ink-60">
                  {category.count.toLocaleString("fr-FR")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}