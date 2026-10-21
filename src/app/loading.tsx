/**
 * Écran de chargement de navigation (App Router).
 *
 * Next.js l'affiche comme fallback instantané quand un segment est suspendu
 * (dev : à chaque navigation vers une route serveur ; production : seulement
 * pendant le streaming RSC). Il est rendu à l'intérieur de la coquille
 * (header, nav, layout racine) : jamais un plein écran qui masque la chrome.
 *
 * AnimatedLoader gère l'anti-clignotement : rien n'apparaît si le segment
 * est prêt en moins de 300 ms (le conteneur invisible réserve simplement la
 * place, donc pas de saut de mise en page), et le symbole officiel feuille +
 * loupe s'anime en CSS pur (opacity/transform, reduced-motion respecté).
 */
import { AnimatedLoader } from "@/components/ui/animated-loader";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <AnimatedLoader label="Chargement en cours" delayMs={300} showProgress />
    </div>
  );
}
