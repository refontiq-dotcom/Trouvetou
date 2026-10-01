import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /**
   * `dark`  — logo encre, à poser sur surface claire (header, fond blanc)
   * `light` — logo blanc, à poser sur surface sombre (footer, encre)
   * `icon`  — symbole seul (favicon, avatar, app icon)
   */
  variant?: "light" | "dark" | "icon";
  /** Hauteur du rendu en pixels */
  size?: "sm" | "md" | "lg";
  /** Classes CSS supplémentaires */
  className?: string;
}

/** Hauteur du logo par taille, en pixels. */
const SIZE_CONFIG = {
  sm: { height: 28 },
  md: { height: 36 },
  lg: { height: 48 },
} as const;

/**
 * Assets officiels (charte graphique) : logo fond clair, logo fond sombre et
 * symbole extrait. Les dimensions sont celles des fichiers servis, afin que
 * l'attribut ratio évite tout saut de mise en page au chargement.
 */
const ASSETS = {
  dark: {
    src: "/brand/logo-on-light.webp",
    width: 542,
    height: 151,
  },
  light: {
    src: "/brand/logo-on-dark.webp",
    width: 1001,
    height: 255,
  },
  icon: {
    src: "/brand/symbol.webp",
    width: 294,
    height: 294,
  },
} as const;

/**
 * Logo Trouvetou — wordmark officiel (feuille + loupe, « tou » en vert citron).
 * Sert les fichiers de marque plutôt qu'un tracé SVG : aucune approximation
 * de la charte, et la couleur ne peut pas dériver de l'implémentation.
 */
export function Logo({ variant = "dark", size = "md", className }: LogoProps) {
  const { height } = SIZE_CONFIG[size];
  const asset = ASSETS[variant];

  return (
    <Image
      src={asset.src}
      alt="Trouvetou"
      width={asset.width}
      height={asset.height}
      className={cn("shrink-0 select-none", className)}
      style={{ height, width: "auto" }}
    />
  );
}
