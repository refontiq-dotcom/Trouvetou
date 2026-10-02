"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Bell, ChevronDown, MapPin, Search, User } from "lucide-react";
import { Logo } from "@/components/logo";
import { LocationPicker } from "@/components/location/location-picker";

interface HomeHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

/**
 * Barre d'en-tête de l'accueil sur desktop : logo officiel, recherche
 * (avec indice de contenu), sélecteur de position, notifications et profil.
 * Elle remplace le header global sur cette page.
 */
export function HomeHeader({ query, onQueryChange, onSubmit }: HomeHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-ink/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3 lg:px-8">
        <Link href="/" aria-label="Trouvetou — Accueil" className="shrink-0">
          <Logo size="sm" />
        </Link>

        <form
          onSubmit={onSubmit}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-full bg-ink-soft py-2 pl-4 pr-2"
        >
          <Search className="h-4 w-4 shrink-0 text-white/70" />
          <span className="flex min-w-0 flex-1 flex-col">
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Que recherchez-vous ?"
              aria-label="Rechercher"
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/80"
            />
            <span className="truncate text-[11px] text-white/45">
              École, clinique, résidence…
            </span>
          </span>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-lime transition-colors hover:bg-white/20"
          >
            <MapPin className="h-3.5 w-3.5" />
            Votre position
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-lime ring-2 ring-ink" />
          </button>
          <Link
            href="/profil"
            aria-label="Mon profil"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </header>
  );
}