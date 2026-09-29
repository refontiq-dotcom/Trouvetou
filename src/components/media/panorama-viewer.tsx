"use client";

/**
 * TROUVETOU — Visionneuse panoramique 360°
 *
 * Photo Sphere Viewer est importé DANS `useEffect` et jamais au niveau du
 * module : c'est la condition pour que Three.js et PSV ne soient pas dans le
 * bundle initial. Ce composant n'est monté qu'après un clic explicite sur
 * « Vue 360° », donc un visiteur qui n'ouvre jamais la visionneuse ne
 * télécharge jamais ces octets.
 *
 * La projection est réellement sphérique/équirectangulaire : l'image est
 * plaquée sur une sphère et la caméra se déplace À L'INTÉRIEUR. Aucune
 * simulation par une image étirée ou une galerie.
 *
 * PSV gère nativement rotation, zoom, gestes tactiles et recadrage. Rien n'est
 * réimplémenté ici : réécrire un contrôleur panoramique serait une source de
 * bugs sans bénéfice. Seuls les BOUTONS sont maison, pour rester dans le design
 * Trouvetou.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, X, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanoramaMedia } from "@/lib/supabase/panorama";

// PSV n'injecte PAS sa feuille de style tout seul : sans cet import, la classe
// `.psv-container` n'a ni `width: 100%` ni `height: 100%`, et le canvas WebGL
// s'affiche à sa taille par défaut au lieu de remplir la visionneuse.
// ~2,7 Ko gzip, chargés une fois avec la page : le poids lourd (Three.js)
// reste, lui, en import dynamique plus bas.
import "@photo-sphere-viewer/core/index.css";

/** Délai au-delà duquel on abandonne plutôt que d'attendre indéfiniment. */
const LOAD_TIMEOUT_MS = 20_000;

/** Champ de vision maximal : plus large = impression de « fenêtre » à pied. */
const MAX_FOV = 100;

/**
 * Vérifie que l'image existe AVANT de construire la visionneuse.
 *
 * Sans cette étape, une image 404 ou un réseau coupé fait échouer PSV dans une
 * promesse que personne n'attend : la visionneuse s'affiche noire, aucun état
 * d'erreur n'apparaît, et une `unhandledRejection` sort dans la console. Ce
 * défaut a été trouvé en pilotant un vrai navigateur, pas en test unitaire —
 * jsdom n'a ni WebGL ni test de collision.
 *
 * L'URL est normalisée en absolue : PSV attend un chemin résolu, et un chemin
 * relatif est ambigu selon la page qui héberge la visionneuse.
 */
function preloadPanorama(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const absolute = new URL(url, window.location.origin).toString();
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(absolute);
    image.onerror = () => reject(new Error(`Image 360° indisponible : ${url}`));
    image.src = absolute;
  });
}

export interface PanoramaViewerProps {
  panorama: PanoramaMedia;
  /** Libellé du lieu, utilisé pour le titre accessible. */
  label: string;
  onClose: () => void;
  className?: string;
}

type Status = "loading" | "ready" | "error";

// Type seul : `import type` est effacé à la compilation, donc PSV n'entre pas
// dans le bundle. Utiliser le type RÉEL de la bibliothèque (et non une
// interface maison) est délibéré : c'est ce qui fait échouer `tsc` si on
// appelle une méthode inexistante. C'est exactement le piège de `reset()`,
// qui n'existe pas en PSV v5 et ne faisait donc rien, en silence.
type PSVViewer = import("@photo-sphere-viewer/core").Viewer;

/** Sous-ensemble du Viewer réellement utilisé ici. */
type ViewerHandle = PSVViewer;

export function PanoramaViewer({ panorama, label, onClose, className }: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  // Position de référence, relevée à l'ouverture. PSV v5 n'a PAS de `reset()` :
  // le recentrage consiste donc à revenir explicitement à ce point.
  const initialRef = useRef<{ yaw: number; pitch: number; zoom: number } | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setStatus("loading");

    // Le timeout est indispensable : sans lui, un panorama 404 ou un réseau
    // coupé laisse la modale bloquée sur un spinner sans issue.
    const timeout = window.setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, LOAD_TIMEOUT_MS);

    void (async () => {
      try {
        // L'image est vérifiée d'abord : PSV n'est construit que si elle
        // existe vraiment, sinon on affiche notre message d'erreur.
        const url = await preloadPanorama(panorama.url);
        if (cancelled) return;

        const { Viewer } = await import("@photo-sphere-viewer/core");
        if (cancelled || !containerRef.current) return;

        const viewer = new Viewer({
          container: containerRef.current,
          // PSV v5 attend `{ path }`. La forme `{ type: "equirectangular",
          // url }` documentée dans les exemples PSV v4 n'est PAS normalisée par
          // v5 : elle partait en `loadTexture` et levait « Invalid panorama url ».
          // Le défaut a été trouvé au navigateur réel. L'adaptateur par défaut
          // EST bien l'équirectangulaire.
          panorama: { path: url },
          // Navbar PSV désactivée : nos boutons gardent le design Trouvetou.
          navbar: false,
          // PSV v5 n'a pas de `defaultFov` : le cadrage passe par un NIVEAU de
          // zoom entre 0 (le plus large) et 100. Le niveau 0 avec un `maxFov`
          // large donne la sensation d'être debout dans la pièce, plutôt que
          // l'effet « oeil de faucon » du réglage par défaut.
          defaultZoomLvl: 0,
          maxFov: MAX_FOV,
          // Le tactile à un doigt est toujours actif dans PSV : c'est le geste
          // naturel « regarder autour ». `touchmoveTwoFingers` à false laisse le
          // pincement au zoom, qui est le geste attendu à deux doigts.
          touchmoveTwoFingers: false,
        });

        viewerRef.current = viewer;
        initialRef.current = {
          yaw: viewer.getPosition().yaw,
          pitch: viewer.getPosition().pitch,
          zoom: viewer.getZoomLevel(),
        };

        // Filet de sécurité réseau : si la texture finit par échouer APRÈS le
        // préchargement (perte de connexion, R2 indisponible), PSV émet
        // `panorama-error`. Sans cet écouteur, l'utilisateur resterait devant un
        // écran noir sans issue.
        viewer.addEventListener("panorama-error", () => {
          if (!cancelled) setStatus("error");
        });
        if (!cancelled) setStatus("ready");
      } catch (error) {
        console.error("[panorama] initialisation impossible", error);
        if (!cancelled) setStatus("error");
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      // Sans ce destroy explicite, le contexte WebGL survit à la fermeture de
      // la modale : la mémoire GPU est perdue à chaque ouverture/fermeture.
      viewerRef.current?.destroy();
      viewerRef.current = null;
      initialRef.current = null;
    };
  }, [panorama.url]);

  const handleRecenter = useCallback(() => {
    // PSV v5 n'expose PAS de `reset()`. Appeler une méthode inexistante
    // donnerait un `undefined?.()` silencieux : le bouton serait cliquable et
    // ne ferait RIEN. D'où le relevé explicite de la position de référence,
    // puis `rotate` + `zoom` pour y revenir.
    const viewer = viewerRef.current;
    const initial = initialRef.current;
    if (!viewer || !initial) return;
    viewer.rotate({ yaw: initial.yaw, pitch: initial.pitch });
    viewer.zoom(initial.zoom);
  }, []);

  // Échap ferme la visionneuse : attendu de tout le monde, et indispensable
  // pour la navigation au clavier.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={cn("absolute inset-0 z-20 flex flex-col bg-navy/95 backdrop-blur-sm", className)}
      role="dialog"
      aria-modal="true"
      aria-label={`Visite 360° — ${label}`}
    >
      {/* Le conteneur WebGL. PSV y injecte son canvas ET un calque
          `.psv-overlay` qui capte les glissements sur toute sa surface.
          `z-0` explicite : sans lui, ce calque passe AU-DESSUS de la barre
          d'outils et le bouton « Recentrer » devient incliquable — visible,
          mais jamais cliqué. Le défaut n'apparaît qu'au navigateur réel :
          jsdom ne fait pas de test de collision. */}
      <div ref={containerRef} className="absolute inset-0 z-0" aria-hidden="true" />

      {status === "loading" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 text-white">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium">Chargement de la visite 360°…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 px-8 text-center text-white">
          <TriangleAlert className="h-9 w-9 text-amber-400" aria-hidden="true" />
          <p className="max-w-xs text-sm font-medium">
            La visite 360° n&apos;a pas pu être chargée. Les photos restent
            disponibles.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-navy"
          >
            Revenir à l&apos;annonce
          </button>
        </div>
      )}

      {/* Barre d'outils discrète, en haut, hors du centre de l'image.
          `z-20` : au-dessus du calque de capture de PSV (z-0) et des
          bandeaux d'état. */}
      <div className="relative z-20 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="rounded-xl bg-navy/70 px-3 py-2">
          <p className="text-sm font-semibold text-white">Vue 360°</p>
          <p className="max-w-[45vw] truncate text-xs text-white/75">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          {status === "ready" && (
            <button
              type="button"
              onClick={handleRecenter}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-navy shadow-sm"
              aria-label="Recentrer la vue"
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-navy shadow-sm"
            aria-label="Fermer la visite 360°"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Aide gestuelle, retirée dès que la visite est prête. */}
      {status === "ready" && (
        <p className="relative z-20 mt-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/70">
          Glissez pour regarder autour · pincez ou utilisez la molette pour zoomer
        </p>
      )}
    </div>
  );
}
