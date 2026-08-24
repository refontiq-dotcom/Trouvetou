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

const SIZE_CONFIG = {
  sm: { height: 28, text: "text-xl", pinSize: 18 },
  md: { height: 36, text: "text-2xl", pinSize: 24 },
  lg: { height: 48, text: "text-4xl", pinSize: 32 },
} as const;

/**
 * Pin SVG réutilisable — remplace le "o" dans "trouvetou".
 * Utilise des paths pour un rendu fidèle à la charte.
 */
function Pin({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 31 44"
      width={size}
      height={size * (44 / 31)}
      fill="none"
      className={cn("inline-block align-baseline", className)}
      aria-hidden="true"
    >
      <path
        d="M15.5 0C6.94 0 0 6.94 0 15.5C0 27.1 15.5 44 15.5 44S31 27.1 31 15.5C31 6.94 24.06 0 15.5 0Z"
        fill="#F9A825"
      />
      <circle cx="15.5" cy="13.5" r="5.5" fill="white" />
    </svg>
  );
}

/**
 * Logo Trouvetou — rendu en HTML/CSS pour garantir la dispo de Poppins.
 * Le premier "o" est remplacé par le pin jaune intégré.
 */
export function Logo({ variant = "dark", size = "md", className }: LogoProps) {
  const { height, text, pinSize } = SIZE_CONFIG[size];

  // ── Variante icône seule (app icon) ──
  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={cn("shrink-0", className)}
        style={{ height, width: height }}
        aria-label="Trouvetou"
      >
        <rect width="48" height="48" rx="12" fill="#1565C0" />
        <g transform="translate(10, 5)">
          <path
            d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.268 21.732 0 14 0z"
            fill="#F9A825"
          />
          <circle cx="14" cy="12" r="5.5" fill="white" />
        </g>
      </svg>
    );
  }

  // ── Variante texte intégré (header / landing) ──
  const textColor = variant === "light" ? "text-white" : "text-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-baseline font-bold tracking-tight select-none leading-none",
        textColor,
        text,
        className
      )}
      style={{ height }}
      aria-label="Trouvetou"
    >
      <span className="font-[family-name:var(--font-poppins)]">tr</span>
      <Pin size={pinSize} className="relative -top-[1px]" />
      <span className="font-[family-name:var(--font-poppins)]">uvetou</span>
    </span>
  );
}
