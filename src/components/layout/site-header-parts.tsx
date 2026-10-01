"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectTargetPortal } from "@/lib/search-intent";
import { VoiceButton } from "@/components/ui/voice-button";

/**
 * Catégories de premier niveau, telles qu'elles apparaissent sur la maquette.
 * Elles ne remplacent pas les univers existants (restaurants, cliniques…) :
 * elles pointent vers les pages réelles, restaurants reste accessible depuis
 * la navigation desktop et le footer.
 */
const PRIMARY_CATEGORIES = [
  { href: "/", label: "Tout" },
  { href: "/ecoles", label: "École" },
  { href: "/cliniques", label: "Clinique" },
  { href: "/hotels", label: "Résidence" },
] as const;

interface SiteSearchProps {
  /** Variante visuelle : sur fond sombre (header) ou clair. */
  tone?: "dark" | "light";
  className?: string;
}

/**
 * Recherche globale du header.
 *
 * Réutilise `detectTargetPortal` : la saisie est routée vers le bon univers
 * (hôtels, écoles, cliniques, restaurants) sans nouvelle logique métier.
 *
 * Le champ n'est volontairement pas initialisé depuis l'URL : le header est
 * rendu sur toutes les pages, et lire `useSearchParams()` ici imposerait une
 * frontière Suspense à tout l'arbre (le prerender de `/404` échouerait).
 * La requête courante reste affichée par la page catalogue, via `initialQuery`.
 */
export function SiteSearch({ tone = "dark", className }: SiteSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const isDark = tone === "dark";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    const target = value
      ? detectTargetPortal(value)?.targetHref ?? "/hotels"
      : "/hotels";
    router.push(value ? `${target}?q=${encodeURIComponent(value)}` : target);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn("flex w-full items-stretch", className)}
    >
      <label htmlFor="site-search" className="sr-only">
        Rechercher un établissement, une école, une clinique
      </label>
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2",
            isDark ? "text-ink-40" : "text-muted-foreground"
          )}
        />
        <input
          id="site-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Que cherchez-vous ?"
          className={cn(
            "h-12 w-full rounded-l-2xl border-0 pl-11 pr-12 text-base",
            // Le champ de recherche est blanc sur un header sombre : l'outline encre
// doit être tracé à l'INTÉRIEUR du champ (offset négatif), sinon il se perd
// sur le fond sombre. `focus-visible` évite l'anneau au clic souris.
"focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
            "placeholder:text-ink-40",
            isDark ? "bg-white text-ink" : "bg-card text-foreground"
          )}
        />
        <VoiceButton
          onResult={(text: string) => setQuery(text)}
          className="!right-1.5 !h-9 !w-9"
        />
      </div>
      <button
        type="submit"
        className={cn(
          "tt-tap inline-flex h-12 items-center gap-2 rounded-r-2xl px-5",
          "text-base font-semibold transition-colors",
          "bg-lime text-ink hover:bg-lime-strong"
        )}
      >
        <Search aria-hidden="true" className="h-5 w-5" />
        <span className="hidden sm:inline">Rechercher</span>
      </button>
    </form>
  );
}

interface CategoryTabsProps {
  className?: string;
}

/** Onglets de catégories — état actif porté par le lime (fond) + le texte. */
export function CategoryTabs({ className }: CategoryTabsProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Catégories" className={cn("-mx-4 overflow-x-auto", className)}>
      <ul className="flex items-center gap-2 px-4">
        {PRIMARY_CATEGORIES.map((category) => {
          const isActive =
            category.href === "/"
              ? pathname === "/"
              : pathname.startsWith(category.href);

          return (
            <li key={category.href} className="shrink-0">
              <Link
                href={category.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-lime text-ink"
                    : "bg-dark-2 text-white hover:bg-ink-80"
                )}
              >
                {category.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}