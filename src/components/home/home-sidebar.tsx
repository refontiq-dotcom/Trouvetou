"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, MapPin, Megaphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryMeta, type HomeCategoryItem } from "@/lib/home-categories";
import { LocationPicker } from "@/components/location/location-picker";

/** Toutes les catégories supportées par l'application. */
export const ALL_CATEGORIES: HomeCategoryItem[] = [
  { slug: "hotel", label: "Hôtels", count: 0 },
  { slug: "residence", label: "Résidences", count: 0 },
  { slug: "school", label: "Écoles", count: 0 },
  { slug: "clinic", label: "Cliniques", count: 0 },
  { slug: "restaurant", label: "Restaurants", count: 0 },
];

/** Barre latérale de l'accueil desktop : affichage de toutes les catégories. */
export function HomeSidebar({ selectedCategory, onCategorySelect, nearbyCount }: { selectedCategory: string | null; onCategorySelect: (slug: string | null) => void; nearbyCount?: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside
      className={cn(
        "hidden w-[280px] shrink-0 lg:block xl:w-[320px]",
        isOpen && "flex flex-col"
      )}
      role="navigation"
      aria-label="Navigation principale"
    >
      {/* === Titre de la sidebar === */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50">
        <h2 className="text-lg font-bold text-neutral-900">Explorer</h2>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Fermer la navigation"
          className="ml-auto flex h-6 w-6 items-center justify-center roundedbg-white/90 text-neutral-600 hover:bg-white transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* === Catégories === */}
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {ALL_CATEGORIES.map((category) => {
            const meta = categoryMeta(category.slug);
            const isActive = selectedCategory === category.slug;

            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => onCategorySelect(category.slug)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-neutral-50",
                  isActive
                    ? "bg-lime text-neutral-900 font-medium"
                    : "text-neutral-800 hover:bg-neutral-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
                )}
                aria-pressed={isActive}
                aria-label={
                  isActive
                    ? `Catégorie ${category.label} active`
                    : `Parcourir ${category.label}`
                }
              >
                <span className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  meta.chipBg
                )}>
                  <span className={meta.chipText} aria-hidden="true" />
                </span>
                <span className="flex-1 truncate text-sm font-medium text-neutral-900">
                  {category.label}
                </span>
                <span className="text-xs font-semibold text-neutral-400">
                  Voir tout
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              </button>
            );
          })}

          {/* Bouton "Tout" pour réinitialiser */}
          <button
            key="tout"
            type="button"
            onClick={() => onCategorySelect(null)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-neutral-50",
              selectedCategory === null
                ? "bg-lime text-neutral-900 font-medium"
                : "text-neutral-800 hover:bg-neutral-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
            )}
            aria-pressed={selectedCategory === null}
            aria-label={
              selectedCategory === null
                ? "Afficher toutes les annonces"
                : "Rétablir le filtre Tout"
            }
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime/20">
              <span className="h-4 w-4 text-lime" aria-hidden="true" />
            </span>
            <span className="flex-1 truncate text-sm font-medium text-neutral-900">
              Tout
            </span>
            <span className="text-xs font-semibold text-neutral-400">Voir tout</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* === Filtres (simplifiés) === */}
      <div className="p-4 border-t border-neutral-200 bg-neutral-50">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Filtres
        </h3>
        <p className="text-xs text-neutral-500 mb-3">
          Affinez votre recherche par prix, type ou localisation
        </p>
        <button
          type="button"
          className="w-full justify-center rounded-lg px-4 py-2 text-sm font-medium text-lime hover:bg-lime/10 transition-colors"
          aria-label="Ouvrir les filtres"
        >
          Filtrer
        </button>
        <p className="text-[10px] text-neutral-400 mt-2">
          Disponible selon la catégorie sélectionnée
        </p>
      </div>
    </aside>
  );
}
