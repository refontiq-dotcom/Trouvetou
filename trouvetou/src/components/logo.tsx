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

const SIZES = {
  sm: { height: 28, fontSize: 22 },
  md: { height: 36, fontSize: 28 },
  lg: { height: 48, fontSize: 38 },
} as const;

export function Logo({ variant = "dark", size = "md", className }: LogoProps) {
  const { height, fontSize } = SIZES[size];

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={cn("shrink-0", className)}
        style={{ height, width: height }}
        aria-label="Trouvetou"
      >
        {/* Blue rounded square */}
        <rect width="48" height="48" rx="12" fill="#1565C0" />
        {/* Gold pin */}
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

  const textColor = variant === "light" ? "#ffffff" : "#1a1a2e";
  const pinYellow = "#F9A825";

  return (
    <svg
      viewBox="0 0 220 48"
      fill="none"
      className={cn("shrink-0", className)}
      style={{ height }}
      aria-label="Trouvetou"
    >
      {/* "tr" */}
      <text
        x="0"
        y="37"
        fontFamily="Poppins, sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        fill={textColor}
      >
        tr
      </text>

      {/* Pin replacing the "o" */}
      <g transform="translate(57, 1)">
        <path
          d="M15.5 0C6.94 0 0 6.94 0 15.5C0 27.1 15.5 44 15.5 44S31 27.1 31 15.5C31 6.94 24.06 0 15.5 0Z"
          fill={pinYellow}
        />
        <circle cx="15.5" cy="13.5" r="6" fill={variant === "light" ? "rgba(255,255,255,0.9)" : "white"} />
      </g>

      {/* "uvetou" */}
      <text
        x="92"
        y="37"
        fontFamily="Poppins, sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        fill={textColor}
      >
        uvetou
      </text>
    </svg>
  );
}
