"use client";

import Link from "next/link";
import { GraduationCap, Home, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Raccourcis vers les portails, affichés sur desktop sous l'en-tête. */
const DESKTOP_CHIPS = [
  { label: "Tout", href: "/", icon: null },
  { label: "École", href: "/ecoles", icon: GraduationCap },
  { label: "Clinique", href: "/cliniques", icon: Plus },
  { label: "Résidence", href: "/hotels", icon: Home },
];

/** Rangée de puces desktop — sur mobile, le menu « Catégories » la remplace. */
export function CategoryChips() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DESKTOP_CHIPS.map((chip) => {
        const active = chip.href === "/";
        const Icon = chip.icon;
        return (
          <Link
            key={chip.label}
            href={chip.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 active:scale-95",
              active ? "bg-lime text-neutral-900" : "bg-white text-neutral-900"
            )}
          >
            {Icon && <Icon className="h-4 w-4" strokeWidth={2.25} />}
            {chip.label}
          </Link>
        );
      })}
    </div>
  );
}