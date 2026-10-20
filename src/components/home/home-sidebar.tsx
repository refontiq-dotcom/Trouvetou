"use client";

import { Anchor, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryMeta, type HomeCategoryItem } from "@/lib/home-categories";

/** Toutes les catégories supportées par l'application. */
export const ALL_CATEGORIES: HomeCategoryItem[] = [
  { slug: "hotel", label: "Hôtels", count: 0 },
  { slug: "residence", label: "Résidences", count: 0 },
  { slug: "school", label: "Écoles", count: 0 },
  { slug: "clinic", label: "Cliniques", count: 0 },
  { slug: "restaurant", label: "Restaurants", count: 0 },
];

interface HomeSidebarProps {
  selectedCategory: string | null;
  onCategorySelect: (slug: string | null) => void;
  /** Conservé pour compatibilité avec l'appelant ; non affiché (pas de chiffre inventé). */
  nearbyCount?: number;
}

/**
 * Barre latérale de l'accueil desktop : navigation par catégorie.
 *
 * Chaque entrée filtre réellement les annonces affichées. Aucun raccourci
 * décoratif ni bouton sans action n'est présenté ici.
 */
export function HomeSidebar({
  selectedCategory,
  onCategorySelect,
}: HomeSidebarProps) {
  const itemClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2",
      active
        ? "bg-lime text-neutral-900"
        : "text-neutral-800 hover:bg-neutral-100"
    );

  return (
    <nav
      aria-label="Catégories"
      className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
    >
      <h2 className="px-2 pb-2 pt-1 text-sm font-bold text-neutral-900">
        Explorer
      </h2>

      <ul className="space-y-1">
        {/* Tout — réinitialise le filtre de catégorie */}
        <li>
          <button
            type="button"
            onClick={() => onCategorySelect(null)}
            aria-pressed={selectedCategory === null}
            className={itemClass(selectedCategory === null)}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
              <Anchor className="h-4 w-4 text-neutral-600" aria-hidden />
            </span>
            <span className="flex-1 truncate text-sm font-semibold">Tout</span>
            {selectedCategory === null && (
              <span className="text-[11px] font-semibold text-neutral-700">
                Actif
              </span>
            )}
          </button>
        </li>

        {ALL_CATEGORIES.map((category) => {
          const meta = categoryMeta(category.slug);
          const Icon = meta.icon;
          const isActive = selectedCategory === category.slug;

          return (
            <li key={category.slug}>
              <button
                type="button"
                onClick={() => onCategorySelect(category.slug)}
                aria-pressed={isActive}
                className={itemClass(isActive)}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    meta.chipBg
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4", meta.chipText)}
                    aria-hidden
                  />
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {category.label}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="px-2 pb-1 pt-3 text-[11px] leading-relaxed text-neutral-500">
        Choisissez une catégorie pour filtrer les annonces affichées.
      </p>
    </nav>
  );
}
