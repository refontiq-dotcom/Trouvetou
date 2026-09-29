import { parsePanoramas, safeHttpUrl, type PanoramaMedia } from "@/lib/supabase/panorama";

// ============================================================================
// TROUVETOU — Ingestion Schooly : tri des médias (§12 du contrat Schooly)
//
// POURQUOI CE FICHIER EXISTE
//
// Jusqu'ici, la route d'ingestion faisait :
//
//     images = school.photos_360          // un panorama dans la galerie !
//
// C'est le défaut que ce module corrige. `photos_360` désigne la visite 360°
// (le code Schooly le confirme : `isPanorama = column === "photos_360"`,
// quota « une seule visite 360° par établissement »). La mettre dans `images`,
// c'est la faire rendre par les consommateurs comme une photo plate :
// `room-card.tsx` fait `room.images[0] ?? PLACEHOLDER_IMAGE`, donc un panorama
// s'affichait en vignette écrasée, sans jamais être explorable.
//
// Le contrat Schooly §12.1 tranche : le payload « gagne un champ `panoramas` »,
// et « rien n'est retiré ni renommé ». Le champ riche existe donc CÔTÉ DE
// `photos_360`, pas à sa place.
//
// LES DEUX FLUX, SÉPARÉS
//
//   cover_photo + gallery  ->  images       ->  galerie classique
//   panoramas               ->  attributes   ->  visionneuse 360°
//
// `photos_360` n'alimente plus `images`. Il reste stocké tel quel dans
// `attributes` : c'est le repli de la §12.3, et surtout une trace qui permet de
// remonter à la source. Il n'est JAMAIS promu en panorama — voir plus bas.
//
// CE QUE CE MODULE REFUSE DE FAIRE (et pourquoi)
//
// Ne PAS fabriquer un panorama depuis une URL nue. `photos_360` est un simple
// tableau de chaînes : pas de `media_type`, pas de `projection`, pas de
// `validated_at`. La §12.5 avertit explicitement que « garantir la projection
// correcte relève du stitcher, qui n'existe pas encore » : une image plate
// collée en 2:1 passerait tous nos contrôles. Déduire `media_type: photo_360`
// d'une URL reviendrait à traiter « URL présente » comme « média publiable »,
// ce que la §12.2 interdit. Tant que Schooly n'émet pas `panoramas`, la
// visionneuse reste simplement vide — ce qui est le comportement honnête.
//
// `room_id` est recopié TEL QUEL et n'est JAMAIS utilisé pour lier. La §12.4
// le déclare non interchangeable avec les identifiants Trouvetou, et la
// migration Schooly le décrit comme nul en pratique. Voir `buildSchoolyListing`
// pour le détail.
// ============================================================================

/** Partie du payload Schooly qui porte des médias. */
export interface SchoolyMediaInput {
  /** Photo principale. */
  cover_photo?: unknown;
  /** Galerie de photos classiques. */
  gallery?: unknown;
  /** Ancienne liste d'URL 360°, conservée pour traçabilité. */
  photos_360?: unknown;
  /** Contrat riche §12, seule source d'un panorama exploitable. */
  panoramas?: unknown;
}

/**
 * Liste d'URL http(s) sûres, dédupliquées, ordre conservé.
 *
 * Le dédoublonnage évite qu'une même photo arrive en double dans la galerie
 * après une réimportation de la part de Schooly.
 */
export function normalizeHttpUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const item of value) {
    const url = safeHttpUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/**
 * Photos classiques de l'annonce : photo principale, puis galerie.
 *
 * La photo principale passe en premier car tous les consommateurs du catalogue
 * prennent `images[0]` comme vignette (`room-card`, `boosted-carousel`,
 * `booking-modal`, `compare`). Un panorama n'a rien à y faire : il n'a pas de
 * « première image », il a un point de vue.
 */
export function toClassicImages(school: SchoolyMediaInput): string[] {
  const seen = new Set<string>();
  const images: string[] = [];
  for (const candidate of [safeHttpUrl(school.cover_photo), ...normalizeHttpUrlList(school.gallery)]) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    images.push(candidate);
  }
  return images;
}

/**
 * Visites 360° publiables, dédupliquées par identifiant stable.
 *
 * Le contrat Schooly garantit à l'émission que seuls les médias au statut
 * `published` sortent (`toTrouvetouMediaContract` renvoie `null` sinon). On ne
 * s'en remet pas pour autant : l'ingestion est une frontière réseau, et une
 * évolution future du payload pourrait faire passer un `uploaded`. Un
 * statut explicite qui n'est pas `published` fait donc rejeter l'entrée.
 *
 * Le dédoublonnage se fait sur `id`, l'identifiant stable du média côté Schooly
 * — et non sur l'URL, qui peut changer de domaine. Deux synchronisations
 * successives, ou un tableau contenant deux fois le même média, produisent donc
 * une liste identique : la synchronisation est idempotente.
 */
export function toPanoramas(school: SchoolyMediaInput): PanoramaMedia[] {
  if (!Array.isArray(school.panoramas)) return [];

  const seen = new Set<string>();
  const panoramas: PanoramaMedia[] = [];

  for (const entry of school.panoramas) {
    if (typeof entry !== "object" || entry === null) continue;
    const status = (entry as { status?: unknown }).status;
    // Garde-fou d'émission : seule une visite publiée est publique.
    if (typeof status === "string" && status !== "published") continue;

    const panorama = parsePanoramas([entry])[0];
    if (!panorama) continue;

    const key = panorama.id || panorama.url;
    if (seen.has(key)) continue;
    seen.add(key);
    panoramas.push(panorama);
  }

  return panoramas;
}