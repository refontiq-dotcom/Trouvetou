"use client";

import { cn } from "@/lib/utils";

/**
 * Logo officiel Trouvetou.
 *
 * Source unique de vérité : le fichier fourni par la marque,
 * `public/brand/TrouveTout_logo_fond_transparent.png`.
 * Aucun SVG, aucun redessin — le composant ne fait que l'afficher
 * à la bonne hauteur (la largeur suit le ratio du fichier).
 */
const LOGO_SRC = "/brand/TrouveTout_logo_fond_transparent.png";

interface LogoProps {
  /** Hauteur d'affichage (la largeur est automatique). */
  size?: "sm" | "md" | "lg";
  /** Classes CSS supplémentaires */
  className?: string;
}

const SIZE_CONFIG = {
  sm: "h-[30px]",
  md: "h-[40px]",
  lg: "h-[52px]",
} as const;

export function Logo({ size = "md", className }: LogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="Trouvetou"
      className={cn("w-auto shrink-0 select-none", SIZE_CONFIG[size], className)}
    />
  );
}