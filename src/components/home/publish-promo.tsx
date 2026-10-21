"use client";

import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Carte d'appel à l'action « Publiez votre annonce ».
 *
 * Affichée sous la navigation par catégorie sur desktop et en bas de la carte
 * catalogue sur mobile. Elle pointe vers l'espace profil, seul point d'entrée
 * existant aujourd'hui pour un propriétaire d'établissement.
 *
 * Le fond est opaque (et non un `lime/15` translucide) pour rester lisible
 * sur l'accueil mobile, dont le fond est encre.
 */
export function PublishPromo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-lime/60 bg-[#f2fad9] p-4",
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-neutral-900 shadow-sm">
        <Megaphone className="h-4 w-4" aria-hidden />
      </span>
      <h2 className="mt-3 text-sm font-bold text-neutral-900">
        Publiez votre annonce
      </h2>
      <p className="mt-1 text-xs text-neutral-600">
        Touchez des milliers de personnes
      </p>
      <Link
        href="/profil"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-lime px-3.5 py-2 text-xs font-bold text-neutral-900 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 active:scale-95"
      >
        Créer une annonce
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
