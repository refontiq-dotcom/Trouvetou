"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  categoryHref,
  getCategory,
  type HomeCategoryItem,
} from "@/lib/categories";

interface HomeSidebarProps {
  /** Catégories affichées (libellés et compteurs issus du registre). */
  categories: HomeCategoryItem[];
}

/**
 * Barre latérale de l'accueil desktop : navigation par catégorie.
 *
 * Chaque entrée est un lien vers la page de sa catégorie : cliquer sur
 * « Résidences » ouvre le portail filtré sur les résidences, et non le
 * portail entier où hôtels et résidences sont mélangés.
 */
export function HomeSidebar({ categories }: HomeSidebarProps) {
  return (
    <nav
      aria-label="Catégories"
      className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
    >
      <h2 className="px-2 pb-2 pt-1 text-sm font-bold text-neutral-900">
        Explorer
      </h2>

      <ul className="space-y-1">
        {categories.map((category) => {
          const definition = getCategory(category.slug);
          const Icon = definition?.icon;

          return (
            <li key={category.slug}>
              <Link
                href={categoryHref(category.slug)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2",
                  "text-neutral-800 hover:bg-neutral-100"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    definition?.chipBg ?? "bg-neutral-100"
                  )}
                >
                  {Icon ? (
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        definition?.chipText ?? "text-neutral-700"
                      )}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="flex-1 truncate text-sm font-medium">
                  {category.label}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-neutral-500">
                  {category.count}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="px-2 pb-1 pt-3 text-[11px] leading-relaxed text-neutral-500">
        Ouvrez une catégorie pour voir toutes ses annonces.
      </p>
    </nav>
  );
}
