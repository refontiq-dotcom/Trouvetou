"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Loader officiel Trouvetou.
 *
 * Affiche le symbole de marque (feuille + loupe), jamais le logo horizontal
 * complet ni une icône générique, aucun redessin. Deux déclinaisons du
 * symbole officiel selon le fond :
 *  - `tone="light"` (défaut, fonds clairs) : `TrouveTout_symbole_transparent.png`,
 *    feuille encre + loupe lime (la feuille blanche serait invisible) ;
 *  - `tone="dark"` (fonds sombres, ex. panneau /auth) : `TrouveTout_symbole_feuille_loupe.png`,
 *    le symbole officiel tel quel, feuille blanche + loupe lime.
 *
 * Animation : fondu d'entrée + pulsation d'échelle très légère + flottement
 * vertical discret, et une fine barre en « avance de phase » indéterminée
 * (aucun pourcentage inventé).
 *
 * Mise en page : le conteneur est toujours monté, donc sa place est réservée
 * dès le premier rendu (aucun décalage de layout quand l'indicateur apparaît).
 *
 * Perf : CSS pur (opacity/transform uniquement), aucune dépendance.
 * Accessibilité : role="status" + libellé lu par les lecteurs d'écran ;
 * aria-busy est posé par l'appelant sur la zone en attente (loading.tsx,
 * fallbacks Suspense) ; prefers-reduced-motion coupe les animations.
 *
 * Anti-clignotement : tant que `delayMs` n'est pas écoulé, le conteneur reste
 * invisible (opacity 0). Un chargement instantané ne montre donc rien.
 */
interface AnimatedLoaderProps {
  /** Libellé lu par les lecteurs d'écran. */
  label?: string;
  /** Délai avant affichage (évite le flash sur chargement très court). */
  delayMs?: number;
  /** Affiche la fine barre de progression indéterminée. */
  showProgress?: boolean;
  /** Fond sur lequel le symbole est posé. */
  tone?: "light" | "dark";
  className?: string;
}

export function AnimatedLoader({
  label = "Chargement en cours",
  delayMs = 300,
  showProgress = true,
  tone = "light",
  className,
}: AnimatedLoaderProps) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "tt-loader-scope flex flex-col items-center justify-center gap-6 py-10",
        visible && "tt-loader-scope--visible",
        className
      )}
    >
      <div className="tt-loader-symbol">
        {/* Symbole officiel : feuille + loupe, extrait du logo de marque. */}
        <img
          src={
            tone === "dark"
              ? "/brand/TrouveTout_symbole_feuille_loupe.png"
              : "/brand/TrouveTout_symbole_transparent.png"
          }
          alt=""
          width={548}
          height={291}
          loading="eager"
          className="tt-loader-img h-16 w-auto sm:h-20 select-none"
          draggable={false}
        />
      </div>
      {showProgress && (
        <div className="tt-loader-track" aria-hidden="true">
          <div className="tt-loader-bar" />
        </div>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
