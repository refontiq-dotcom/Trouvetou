"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  /** Variantes d'affichage */
  variant?: "light" | "dark" | "icon";
  /** Taille du logo */
  size?: "sm" | "md" | "lg";
  /** Classes CSS supplémentaires */
  className?: string;
}

/**
 * Couleurs officielles — Charte graphique Trouvetou
 */
const BRAND = {
  blue: "#0066FF",
  navy: "#00215E",
  orange: "#FFA726",
  white: "#FFFFFF",
} as const;

/** Hauteur du logo complet (mot + icône) par taille, en pixels. */
const SIZE_CONFIG = {
  sm: { height: 28 },
  md: { height: 36 },
  lg: { height: 48 },
} as const;

/**
 * Icône Trouvetou — anneau bleu, point marine central, ruban orange.
 * Remplace le premier "o" du mot "trouvetou". Dessinée dans un viewBox
 * dédié (40 x 56) puis composée avec le texte dans un unique SVG pour
 * garantir un alignement pixel-perfect avec la typographie.
 */
function BrandMark({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <circle
        cx="20"
        cy="18"
        r="14"
        fill="none"
        stroke={BRAND.blue}
        strokeWidth="7.5"
      />
      <circle cx="20" cy="18" r="5.5" fill={BRAND.navy} />
      <path
        d="M13.5 32 L26.5 32 L26.5 47 L20 41.5 L13.5 47 Z"
        fill={BRAND.orange}
      />
    </g>
  );
}

/**
 * Logo Trouvetou — wordmark officiel.
 * Rendu en un unique SVG (texte "tr" / icône / texte "uvetou") pour un
 * alignement fidèle à la charte, quelle que soit la police chargée.
 */
export function Logo({ variant = "dark", size = "md", className }: LogoProps) {
  const { height } = SIZE_CONFIG[size];

  // ── Variante icône seule (favicon, app icon, avatar) ──
  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 40 56"
        className={cn("shrink-0", className)}
        style={{ height, width: height * (40 / 56) }}
        aria-label="Trouvetou"
      >
        <BrandMark />
      </svg>
    );
  }

  const textColor = variant === "light" ? BRAND.white : BRAND.navy;

  return (
    <svg
      viewBox="0 0 340 90"
      className={cn("shrink-0 select-none", className)}
      style={{ height, width: height * (340 / 90) }}
      aria-label="Trouvetou"
      role="img"
    >
      <text
        x="0"
        y="60"
        fontFamily="Poppins, sans-serif"
        fontWeight="700"
        fontSize="64"
        fill={textColor}
      >
        tr
      </text>
      <BrandMark x={49} y={15.5} scale={1.236} />
      <text
        x="98"
        y="60"
        fontFamily="Poppins, sans-serif"
        fontWeight="700"
        fontSize="64"
        fill={textColor}
      >
        uvetou
      </text>
    </svg>
  );
}
