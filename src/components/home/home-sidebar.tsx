"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, MapPin, Megaphone } from "lucide-react";
import { categoryMeta, type HomeCategoryItem } from "@/lib/home-categories";
import { LocationPicker } from "@/components/location/location-picker";

/** Slugs mis en avant dans la carte « Catégories populaires ». */
const POPULAR_SLUGS = ["school", "clinic", "residence", "hotel"];

/** Barre latérale de l'accueil desktop : 3 cartes d'appel à l'action. */
export function HomeSidebar({ categories }: { categories: HomeCategoryItem[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const popular = categories
    .filter((c) => POPULAR_SLUGS.includes(c.slug))
    .slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Publiez votre annonce */}
      <div className="rounded-3xl bg-lime/15 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-neutral-900">
          <Megaphone className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-base font-bold text-neutral-900">
          Publiez votre annonce
        </h3>
        <p className="mt-1 text-xs text-neutral-600">
          Touchez des milliers de personnes
        </p>
        <Link
          href="/profil"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-sm font-bold text-neutral-900 transition-transform hover:-translate-y-0.5"
        >
          Créer une annonce
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Catégories populaires */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-bold text-neutral-900">
          Catégories populaires
        </h3>
        <ul className="mt-2">
          {popular.map((category) => {
            const meta = categoryMeta(category.slug);
            const Icon = meta.icon;
            return (
              <li key={category.slug}>
                <Link
                  href={meta.href}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-neutral-50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-neutral-700" />
                  <span className="flex-1 text-sm text-neutral-800">
                    {category.label}
                  </span>
                  <span className="text-xs font-semibold text-neutral-400">
                    Voir tout
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Trouve tout près de chez toi */}
      <div className="relative overflow-hidden rounded-3xl bg-ink p-5">
        <MapPin
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 text-lime/15"
        />
        <MapPin className="h-6 w-6 text-lime" />
        <h3 className="mt-3 text-base font-bold leading-snug text-white">
          Trouve tout près de chez toi
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-white/70">
          Des établissements à proximité de votre position
        </p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-sm font-bold text-neutral-900 transition-transform hover:-translate-y-0.5"
        >
          Voir sur la carte
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {pickerOpen && <LocationPicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}