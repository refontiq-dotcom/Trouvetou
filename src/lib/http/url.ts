// ============================================================================
// TROUVETOU — Validation des URL de médias externes
//
// POURQUOI CE FICHIER EXISTE
//
// Les images, panoramas 360° et vignettes d'une annonce arrivent d'une
// INGESTION DISTANTE : le provider pousse un JSON, Trouvetou le stocke, et le
// navigateur du visiteur le charge ensuite. Une simple vérification
// `typeof x === "string"` laisse passer n'importe quel schéma d'URL.
//
// Or les URL affichées finissent dans des attributs que le navigateur
// interprète : `src` d'une image, `href` d'un lien, source d'une texture
// WebGL. Un `javascript:alert(1)` stocké dans `scene.src` n'est pas un bug
// théorique : c'est de l'exécution de script chez tous les visiteurs d'une
// annonce, déclenchable par n'importe quel provider authentifié par clé.
//
// RÈGLE : on n'accepte QUE `http:` et `https:`. Tout le reste est refusé.
//
// Ce module est PUR : aucun import React, aucun accès réseau, aucun effet de
// bord. Testable seul — et testé aussi à travers les points d'ingestion réels.
// ============================================================================

/**
 * Protocoles acceptés pour un média externe.
 *
 * Liste d'ALLOWLISTE, pas de liste de refus. `javascript:`, `data:`,
 * `vbscript:`, `blob:`, `file:` et `ftp:` sont donc refusés par construction :
 * ajouter un jour un nouveau risque n'exige pas de penser à le bloquer.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Longueur maximale acceptée pour une URL de média.
 *
 * Garde-fou contre les valeurs aberrantes envoyées par un provider : au-delà,
 * l'URL est de toute façon inutilisable et son stockage gonflerait
 * `attributes` / `images` pour rien.
 */
const MAX_URL_LENGTH = 2048;

/**
 * URL absolue http(s) sûre, ou `null`.
 *
 * `new URL` est utilisé plutôt qu'un `startsWith("https://")` parce qu'il
 * normalise et rejette ce qu'un test de préfixe laisserait passer :
 *
 *   - `"  https://a.test/x.jpg"`  → espaces en tête : URL() tronque, on accepte
 *   - `"java\tscript:alert(1)"`   → tabulation : URL() la retire, on détecte
 *                                   `javascript:` et on refuse
 *   - `"//a.test/x.jpg"`          → URL relative protocol-relative : refusée
 *   - `"/x.jpg"`                  → URL relative : refusée
 *   - `"http://"`                 → hôte vide : refusée
 *
 * Le paramètre `base` est volontairement ABSENT : une URL de média doit être
 * absolue. Autoriser une base reviendrait à résoudre un chemin relatif contre
 * l'origine Trouvetou, ce qui exposerait des routes internes du portail.
 *
 * @param value   Valeur brute provenant des données externes.
 * @returns L'URL normalisée et validée, ou `null` si elle est inutilisable.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // URL relative, malformée, ou contenant un caractère interdit.
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  if (url.hostname === "") return null;

  return url.toString();
}

/**
 * Liste d'URL http(s) sûres, dédupliquées, ordre d'origine conservé.
 *
 * Utilisée pour les galeries d'images : une même photo réimportée par un
 * provider ne doit pas apparaître en double. Le dédoublonnage porte sur l'URL
 * normalisée, donc `HTTP://A.test/x.jpg` et `http://a.test/x.jpg` — qui sont
 * la même ressource — comptent comme une seule entrée.
 *
 * Une entrée invalide est IGNORÉE silencieusement : une galerie ne doit pas
 * faire disparaître l'annonce entière à cause d'une URL cassée.
 */
export function safeHttpUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const item of value) {
    const url = safeHttpUrl(item);
    if (url === null || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}