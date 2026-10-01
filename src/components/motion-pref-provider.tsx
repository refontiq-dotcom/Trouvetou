"use client";

import { MotionConfig } from "framer-motion";

/**
 * Préférence système « réduire les animations ».
 *
 * Framer Motion n'a pas d'équivalent de la media query CSS : sans ce provider,
 * chaque `motion.*` du produit (15 fichiers) s'anime même quand l'utilisateur a
 * demandé moins de mouvement. `reducedMotion="user"` applique la préférence au
 * niveau racine — donc aussi aux animations imbriquées et aux `AnimatePresence` —
 * sans avoir à toucher chaque composant.
 *
 * Sans état : aucun rendu client supplémentaire pour les pages serveur.
 */
export function MotionPrefProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}