# Audit Trouvetou — code, sécurité, données, SEO

**Date :** 18 octobre 2026
**Périmètre :** dépôt complet (`src/`, `supabase/`, configuration Next.js), 72 fichiers TS/TSX, 8 870 lignes, 8 pages, 8 routes API, 8 migrations + `schema.sql`.
**Méthode :** lecture du code source et du schéma, `tsc --noEmit`, `eslint src`, inspection du runtime (aperçu sur le port 3000), appels HTTP réels sur chaque route API, vérification des en-têtes de garde (CSRF, 401, 405).

---

## 1. Synthèse

| Domaine | État | Commentaire |
|---|---|---|
| Compilation / lint | ✅ Bon | `tsc` 0 erreur, `eslint` 0 erreur / 7 warnings |
| Sécurité des endpoints sensibles | ✅ Bon | CSRF fail-closed, HMAC + comparaison constante, contrôle center protégé |
| Ingestion de données (`/api/v1/sync`) | 🔴 À corriger | Injection dans le filtre PostgREST, erreur silencieuse |
| Configuration / démarrage | 🔴 Bloquant | Aucune variable d'environnement : tout le dynamique renvoie 500 |
| Authentification & données utilisateur | 🟠 Incomplet | 100 % localStorage, tables `favorites`/`profiles` prêtes mais inutilisées |
| Justesse fonctionnelle | 🟠 Bugs | Favoris et comparateur restreints aux hôtels/résidences |
| SEO / PWA / a11y | 🟠 Partiel | Pas de sitemap/robots/OG, zoom désactivé, thème PWA incohérent |
| Tests / CI | 🟠 Partiel | Suite pgTAP de sécurité présente mais cassée (`plan(13)` pour 12 assertions), aucun test applicatif, aucune CI |

**Verdict :** la base technique est saine et les gardes de sécurité des routes publiques sont sérieuses — au-dessus de la moyenne pour un projet de cette taille. Les vrais risques ne sont pas dans le code de sécurité mais dans **l'exploitation** (aucun environnement configuré), **la couche d'ingestion** (filtre non échappé) et **le périmètre produit** (favoris/alertes non persistés, comparateur bridé).

---

## 2. P0 — Bloquants

### P0-1. Aucun environnement configuré : le produit ne sert que des données fictives

`freebuff-env list` ne retourne **aucune** clé. Conséquence vérifiée en direct sur l'aperçu :

| Endpoint | Code | Réponse |
|---|---|---|
| `GET /api/catalog/listings` | **500** | « Configuration serveur incomplète (TROUVETOU_SUPABASE_URL / …) » |
| `GET /api/catalog/categories` | **500** | idem |
| `POST /api/traffic` | **500** | idem |
| `POST /api/catalog/bookings` | 500 / 503 | config + annulation désactivée |
| `POST /api/v1/sync` | 500 | pepper absent |

Et l'accueil ne « tombe » pas en erreur : il affiche silencieusement les 4 annonces codées en dur de `src/app/page.tsx` (`FALLBACK_LISTINGS`, images Unsplash, prix inventés, `href: "/hotels"`). **Un visiteur ne peut pas distinguer la démo d'un catalogue réel.** C'est le point le plus dangereux du projet : la panne est invisible.

**Correctif :**
1. Renseigner les clés : `TROUVETOU_SUPABASE_URL`, `TROUVETOU_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TROUVETOU_API_KEY_PEPPER`, `NEXT_PUBLIC_SITE_URL`.
2. Rendre l'absence de données **visible** : si `getFeaturedListings()` renvoie `[]` et que la base n'est pas configurée, afficher un état « catalogue indisponible » plutôt que des annonces fictives. Garder le fallback uniquement derrière un flag explicite (`NEXT_PUBLIC_DEMO=false` en prod).
3. Ajouter `GET /api/health` (Supabase joignable + version) pour les sondes de déploiement.

### P0-2. `/api/v1/sync` : injection dans le filtre PostgREST du soft-removal

`src/app/api/v1/sync/route.ts:253`

```ts
.filter("external_id", "not.in", `(${externalIds.join(",")})`)
```

`external_id` vient du payload du fournisseur, validé uniquement comme « chaîne non vide ». PostgREST interprète la valeur comme du **langage de filtre** : une valeur contenant `,`, `)` ou `"` casse le `in.(…)`, et une valeur forgée peut refermer le groupe. Combiné au fait que **le résultat de cet `update` n'est jamais vérifié**, deux conséquences :

- un `external_id` légitime contenant une virgule (référence « REF-2024, A ») fait échouer silencieusement la désactivation → **annonces périmées qui restent affichées indéfiniment** ;
- un fournisseur peut neutraliser le filtre et masquer une partie de son propre catalogue (impact limité à ses annonces par le `.eq("provider_id")`, mais le comportement est imprévisible).

**Correctif :** remplacer le filtre par un RPC SQL `deactivate_missing_listings(p_provider_id uuid, p_external_ids text[])` avec `WHERE provider_id = $1 AND NOT (external_id = ANY($2))`, et **vérifier l'erreur** du retour. À défaut, filtrer en type `text[]` via `.not("external_id", "in", …)` n'existe pas : le RPC est la seule voie propre.

### P0-3. Rotation de clé API possible sans pepper → clé définitivement inutilisable

`src/lib/sync/api-key.ts:28`

```ts
const pepper = process.env.TROUVETOU_API_KEY_PEPPER ?? "";
```

Les routes de rotation (`/api/internal/control-center/…`) **ne vérifient pas** la présence du pepper avant de calculer l'empreinte. Si `TROUVETOU_API_KEY_PEPPER` est absent au moment de la rotation :

1. le hash est calculé avec un pepper vide ;
2. la clé est renvoyée à l'opérateur comme « configurée » ;
3. `/api/v1/sync` refuse ensuite de démarrer sans pepper, et une fois le pepper configuré le hash ne correspond plus.

Résultat : intégration cassée jusqu'à une nouvelle rotation. Le même défaut existe pour `/api/v1/sync/schooly`.

**Correctif :** faire échouer `hashApiKey()` (throw) si le pepper est vide, et ajouter dans les deux routes de rotation le garde déjà présent dans `/api/v1/sync` (lignes 69-75). Idéalement, centraliser le garde dans `getAdminClient` / un helper `requireServerConfig()`.

---

## 3. P1 — Haute priorité

### P1-1. Favoris et comparateur bridés aux hôtels/résidences (bug fonctionnel)

`src/lib/supabase/hotels.ts:34` applique par défaut `HOTELS_SECTION_CATEGORIES = ["hotel","residence"]` quand aucun filtre n'est fourni. Or :

- `src/app/favoris/page.tsx:36` appelle `fetchListedListings({ limit: 100 })` **sans catégories** ;
- `src/app/compare/page.tsx:22` appelle `fetchListedListings({ limit: 200 })` **sans catégories**.

Conséquence : une école ou une clinique mise en favori **n'apparaît jamais** dans « Mes favoris », et le comparateur est incapable de comparer une école à une clinique — alors que le produit est vendu comme un comparateur multi-secteur. Le bogue est silencieux (la page affiche simplement moins de cartes).

**Correctif :** passer les catégories explicitement (`categorySlugs: ["hotel","residence","school","clinic","restaurant"]`) ou rendre le défaut neutre et laisser chaque appelant choisir.

### P1-2. « Mes favoris » charge tout le catalogue et filtre côté client

`src/app/favoris/page.tsx:36-45` récupère 100 annonces puis `.filter(r => favorites.has(r.id))`. Un favori au-delà du 100ᵉ rang (tri par `updated_at`) **disparaît sans message**. Coût réseau inutile à chaque visite.

**Correctif :** ajouter un paramètre `ids` à `/api/catalog/listings` (`id.in.(…)`) et ne charger que les favoris, quelle que soit leur position.

### P1-3. Le formulaire d'alerte email simule un succès (donnée personnelle perdue)

`src/components/alerts/alert-subscribe.tsx:31-45` : l'adresse est écrite dans `localStorage` puis l'UI affiche « Alerte enregistrée ! Vous serez notifié de nouvelles annonces ». Aucun email ne partira jamais, aucune table ne reçoit la donnée, et l'adresse est perdue au changement d'appareil.

C'est à la fois un **bug produit** (promesse non tenue) et un **risque de conformité** : collecte d'un email avec un consentement implicite, sans finalité ni suppression réelle.

**Correctif immédiat :** soit désactiver la promesse (« Bientôt disponible »), soit brancher une vraie table `alerts` (RLS insert-only pour anon) + un envoi transactionnel côté serveur (Resend/Postmark) via une action. Ne pas laisser une fausse confirmation en production.

### P1-4. Compteur de trafic ouvert et manipulable

`src/app/api/traffic/route.ts` n'applique **ni** `verifySameOrigin` **ni** rate-limit, contrairement à `/api/catalog/bookings`. N'importe qui peut boucler un `curl` et gonfler `visits` (et déclencher un POST serveur vers le Control Center à chaque appel). Le champ `unique_visitors` est fourni par le client, donc non fiable par construction.

**Correctif :** appliquer `verifySameOrigin` + le limiteur d'IP existant, dériver l'unicité d'un cookie signé côté serveur (ou d'un hash IP+jour), et ne pousser les métriques qu'une fois par jour.

### P1-5. Aucune authentification : les données utilisateur ne quittent pas le navigateur

Le schéma contient déjà `profiles` et `favorites` avec RLS propre (`auth.uid() = user_id`, privilèges révoqués pour `anon`), et le code ne s'en sert pas : favoris, position, réservations et alertes vivent dans `localStorage`. Il n'y a ni `@supabase/ssr`, ni session, ni route d'auth.

Conséquences : favoris perdus au changement d'appareil ou au vidage du cache, réservations invisibles si l'utilisateur change de navigateur, aucun historique fiable côté support. Les tables et policies sont du code mort en attendant.

**Décision requise :** soit brancher Supabase Auth (magic link suffit) et synchroniser favoris/profils, soit assumer explicitement le « sans compte » et supprimer les tables pour éviter la fausse impression d'un backend utilisateur.

### P1-6. Service worker enregistré en développement

`src/components/pwa-register.tsx:8` enregistre `/sw.js` sans condition. `public/sw.js` précache `/`, `/ecoles`, `/cliniques`, `/hotels`, `/restaurants` et applique du **cache-first** sur `/_next/static`, `.js`, `.css`, images. En développement (et sur les aperçus), cela sert des chunks périmés — exactement le type de panne qui produit des erreurs d'hydratation fantômes déjà rencontrées sur ce projet.

**Correctif :** n'enregistrer le SW qu'en production, et dériver `CACHE_NAME` d'un identifiant de build (`trouvetou-${commit}`) plutôt que de le bumper à la main.

### P1-7. Aucun en-tête de sécurité

Pas de `middleware.ts`, pas de `headers()` dans `next.config.ts`. Il manque `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (géolocalisation/micro — le projet les utilise) et `X-Frame-Options`/`frame-ancestors`. Aucune CSP : la défense en profondeur contre une future régression XSS est nulle.

Le code n'a aujourd'hui **aucun** `dangerouslySetInnerHTML` (vérifié) — la surface XSS est faible — mais les en-têtes coûtent dix lignes.

**Correctif :** ajouter `async headers()` dans `next.config.ts` (ou un middleware) avec ces cinq en-têtes + une CSP en `Report-Only` d'abord, à cause des scripts inline de Next/Unsplash.

### P1-8. SEO incomplet

`src/app/layout.tsx` n'a pas de `metadataBase` (les URLs relatives des OG seront relatives), ni `openGraph`/`twitter`, ni `robots`, ni `sitemap.ts`. Les 5 pages de portail ont un `metadata` mais aucun ne définit d'image sociale. Aucune page n'expose de données structurées (`Organization`, `ItemList`, `LocalBusiness`) alors que le produit est un annuaire local — c'est le levier SEO le plus rentable ici.

**Correctif :** `metadataBase` + OG/Twitter par défaut, `src/app/sitemap.ts` et `src/app/robots.ts` générés depuis les catégories, JSON-LD sur les portails.

### P1-9. Zoom désactivé (accessibilité)

`src/app/layout.tsx:39-40` : `maximumScale: 1`, `userScalable: false`. Empêche le zoom sur mobile — échec WCAG 1.4.4, et pénalisant pour une audience âgée ou malvoyante. Next.js émet d'ailleurs un avertissement à ce sujet.

**Correctif :** supprimer les deux propriétés.

---

## 4. P2 — Moyen terme

### P2-1. Rate limiting en mémoire, inefficace en production serverless
`src/lib/http/request-guard.ts:130` le documente honnêtement : sur Vercel, chaque instance a sa `Map`. Les plafonds `check: 20`, `create: 5`, `cancel: 10` par minute sont donc contournables en tapant plusieurs instances. Correctif : Upstash Redis / Vercel Firewall pour le plafond dur, en gardant le limiteur local comme premier filtre.

### P2-2. `x-forwarded-for` comme identité client
`getClientKey()` prend la **première** valeur de `x-forwarded-for`, qui est celle fournie par le client sur la plupart des plateformes → contournement du rate-limit par simple en-tête forgé. Préférer `x-vercel-forwarded-for`/`x-real-ip` (posés par la plateforme) avant de retomber sur `x-forwarded-for`.

### P2-3. Logo de 510 Ko servi sans optimisation
`public/brand/TrouveTout_logo_fond_transparent.png` : 2127×739, 510 Ko, affiché dans le header, le header mobile, le footer et l'accueil — et `next.config.ts` force `images.unoptimized: true`. C'est l'élément LCP de toutes les pages. Correctif : dériver des variantes ~480 px (header) et ~960 px (footer/hero) en WebP/AVIF, garder le PNG source hors du chemin critique. **Ne pas redessiner le logo** : uniquement le redimensionner.

### P2-4. Quatre `<img>` bruts et `unoptimized`
`src/components/home/listing-card.tsx:36`, `pub-banner.tsx:138`, `src/components/logo.tsx:30`, `src/app/compare/page.tsx:101` (+ 3 fichiers utilisant `next/image`). Aucune largeur/hauteur sur certaines images dans une grille → CLS possible. Correctif : `next/image` avec `sizes`, ou au minimum `width/height/loading="lazy"` explicites.

### P2-5. Thème PWA incohérent avec le nouveau design
`src/app/layout.tsx:41` `themeColor: "#00215E"` et `public/manifest.json` `theme_color: "#00215e"`, `background_color: "#ffffff"` : ce sont les couleurs de l'ancienne identité, alors que l'app est passée à l'encre `#0b0f14` / lime `#b5e04b`. Effet visible : barre système bleue et **flash blanc** au lancement de la PWA sur un thème sombre. Correctif : `#0b0f14` partout (`themeColor`, manifest, meta `apple-mobile-web-app-status-bar-style`).

### P2-6. `safeSecretEqual` dupliqué trois fois
`src/lib/http/request-guard.ts:177` (exporté), puis recopié à l'identique dans deux routes du Control Center. C'est exactement le type de duplication où une correction de sécurité n'atteint qu'un fichier sur trois. Correctif : importer la version de `request-guard`.

### P2-7. UUID de providers codés en dur dans le code applicatif
`src/app/api/internal/control-center/projects/.../credentials/route.ts:5-20` fige trois UUID de production. Une nouvelle base (staging, restauration) casse silencieusement la rotation. Correctif : table `provider_integrations(project, integration, provider_id)` ou variables d'environnement.

### P2-8. `schema.sql` non idempotent et divergent des migrations
`supabase/schema.sql` ne contient que 2 `IF NOT EXISTS` pour 9 `CREATE TABLE`, et les 8 migrations qui suivent ne sont pas rejouées dedans. Un nouvel environnement ne peut pas être monté par simple exécution du fichier ; le risque de dérive entre la doc et la base réelle est élevé. Correctif : soit `schema.sql` généré (`supabase db dump`), soit un `README` qui impose `migrations/` comme seule source de vérité.

### P2-9. Commentaires obsolètes sur les privilèges `providers`
`src/lib/supabase/listings.ts:10` (et `:120`) affirment que « le rôle anon ne peut pas lire providers (pas de politique RLS) », alors que `supabase/schema.sql:188` crée bien `providers_select_public` et accorde des privilèges de colonne. La route `/api/catalog/listings` commente la même chose. Un futur développeur risque de « réparer » un problème déjà résolu, ou l'inverse. Correctif : réaligner les commentaires sur le schéma.

### P2-10. Auto-fetch serveur avec un domaine de repli codé en dur
`src/lib/supabase/listings.ts:132` et `:189` retombent sur `https://trouvetou.vercel.app` quand `NEXT_PUBLIC_SITE_URL` est absent. Un appel serveur peut ainsi partir vers **la production** depuis un environnement local ou de staging. Correctif : exiger `NEXT_PUBLIC_SITE_URL` côté serveur, ou appeler la base directement (page d'accueil déjà bien faite sur ce point).

### P2-11. Pas de tests applicatifs, ni CI, ni script `typecheck`
`package.json` : `dev`, `build`, `start`, `lint` — pas de `typecheck`, pas de `test`. Aucun runner n'est installé (vitest/playwright), aucune workflow GitHub. La suite `supabase/tests/production_audit_security.test.sql` couvre le bon périmètre (privilèges `anon` sur `provider_api_key_aliases`, `sync_logs`, `trouvetou_traffic_daily`, exécution des RPC, `search_path` épinglé) mais **ne peut pas passer en l'état** : elle déclare `select plan(13)` (ligne 12) alors qu'elle ne contient que **12** assertions `select ok(…)` — `finish()` échoue donc systématiquement sur l'écart plan/exécution. S'y ajoute un test dépendant des données de production (« only the canonical Séjoura source »), rouge sur une base vierge. La suite n'étant branchée à aucune CI, la casse est passée inaperçue.

**Correctif :** corriger `plan(13)` → `plan(12)`, isoler le test dépendant des données (ou le rendre conditionnel), puis `"typecheck": "tsc --noEmit"`, `vitest` pour les 4 modules purs les plus critiques (`api-key`, `request-guard`, `geo`, `search-intent`), et un workflow qui lance lint + typecheck + tests à chaque PR.

### P2-12. Aucun `loading.tsx` / `error.tsx` / `not-found.tsx`
Les 8 routes n'ont aucun état de chargement serveur ni de frontière d'erreur. Une erreur de rendu ou une 404 affiche l'écran par défaut de Next, en anglais et hors charte. Correctif : un `src/app/not-found.tsx` + un `error.tsx` global suffisent à couvrir les 8 routes.

---

## 5. P3 — Dette mineure

- `src/components/hotels/room-card.tsx:8` : import `X` inutilisé (seul warning réel d'ESLint).
- 4 warnings `@next/next/no-img-element` : voir P2-4.
- `src/app/compare/page.tsx:34` (deux warnings) : dépendance `ids` non stabilisée dans un `useEffect` (tableau recréé à chaque rendu → refetch potentiel) + expression complexe dans le tableau de dépendances.
- `next.config.ts` : pas de `poweredByHeader: false`.
- `REFONTIQ_CONTROL_CENTER_SECRET` : préfixe d'une autre marque dans un projet Trouvetou — à renommer tant que la valeur n'est pas partagée avec un autre service.
- `src/lib/supabase/database.types.ts` : type `schooly_sync_school` absent, contourné par un cast `as unknown as` dans `/api/v1/sync/schooly` (ligne 162). Régénérer les types (`supabase gen types`) supprimerait ce cast.
- `src/lib/supabase/hotels.ts` conserve un nom de fichier « hotels » pour un service désormais multi-secteur → renommer en `catalog.ts` faciliterait la lecture (et éviterait le bogue P1-1).
- `AGENTS.md` ne contient que les règles Next.js générées : aucune convention projet (nommage, structure, style des commits).

---

## 6. Ce qui est solide (à ne pas casser)

1. **Gardes des routes publiques** : `verifySameOrigin` est *fail-closed* (aucune origine configurée → refus), le CSRF est testé en direct (403 sur `Origin: https://evil.example`), `cancel` exige un secret serveur dédié, et le message d'erreur n'expose pas la config.
2. **Authentification des intégrations** : clé `tv_live_<providerId>.<secret>` (32 octets aléatoires), stockage d'un **HMAC-SHA256 salé**, comparaison `timingSafeEqual`, résolution O(1) du provider. C'est un design propre.
3. **Prix jamais calculé côté client** : `check` recalcule le total depuis `listings.base_price` (ou le montant PMS s'il est fourni) ; le montant affiché n'est pas modifiable par le navigateur.
4. **Validation d'entrée** : dates `YYYY-MM-DD` + cohérence check-in/check-out, bornes sur nom (120), téléphone (30), email (254 + regex), demandes spéciales (2000), `number_of_guests` 1-50, `listing_id` filtré sur `is_available` **et** `providers.is_active`.
5. **RLS Supabase** : colonne `attributes` (qui contient `sejoura_api_key`) révoquée pour `anon`/`authenticated`, `api_key_hash` et `webhook_url` masqués, `sync_logs` sans policy, tables `favorites`/`profiles` limitées à `auth.uid()`, RPC `search_path` épinglé. La migration `20260828_fix_listings_attributes_leak.sql` montre que la fuite a déjà été identifiée et fermée.
6. **Aucun secret côté client** : le client `service_role` n'est importé que par les 8 route handlers ; vérifié fichier par fichier.
7. **Zéro `any`**, aucun `console.log` résiduel, `dangerouslySetInnerHTML` absent. Les 7 `as unknown as` restants correspondent à des jointures PostgREST que les types générés ne modélisent pas (et au RPC Schooly) : acceptable, mais à résorber en régénérant `database.types.ts`.
8. **Images distantes nettoyées** : recherche `q` tronquée à 100 caractères et caractères PostgREST neutralisés (`[%,().:]` → espace) avant `.or()`.

---

## 7. Plan d'action suggéré

**Semaine 1 — rendre le produit vrai**
1. Configurer l'environnement (P0-1) et masquer/retirer les annonces de démonstration en production.
2. Corriger le soft-removal par RPC (P0-2) et le garde pepper (P0-3).
3. Débrider favoris + comparateur (P1-1) et charger les favoris par identifiants (P1-2).
4. Trancher : vraies alertes email ou promesse retirée (P1-3).

**Semaine 2 — durcissement et visibilité**
5. Protéger `/api/traffic` (P1-4), brancher ou retirer l'auth (P1-5).
6. SW production-only (P1-6), en-têtes de sécurité (P1-7).
7. SEO : `metadataBase`, OG, sitemap, robots, JSON-LD (P1-8) ; zoom mobile (P1-9).
8. Logo redimensionné + `next/image` (P2-3, P2-4), thème PWA (P2-5).

**Ensuite — industrialisation**
9. `typecheck` + vitest + CI (P2-11), `error.tsx`/`not-found.tsx` (P2-12).
10. Rate-limit distribué, `x-real-ip`, consolidation des helpers (P2-1/2/6), nettoyage du schéma (P2-8).

---

## 8. Vérifications exécutées

```
npx tsc --noEmit                  → 0 erreur
npx eslint src                    → 0 erreur, 7 warnings (4 no-img-element, 2 exhaustive-deps, 1 unused)
GET  /                            → 200 (78,5 Ko)
GET  /hotels /ecoles /cliniques /restaurants /favoris /profil /compare → 200
GET  /api/catalog/listings        → 500 (config serveur absente)
GET  /api/catalog/categories      → 500 (config serveur absente)
POST /api/catalog/bookings (Origin: https://evil.example) → 403 ORIGIN_FORBIDDEN ✅
GET  /api/v1/sync                 → 405 METHOD_NOT_ALLOWED ✅
POST /api/internal/control-center/trouvetou-key (sans secret) → 401 ✅
POST /api/traffic                 → 500 (config serveur absente)
HTML servi vs source              → cohérent (classes `lg:block xl:w-[320px]` / `2xl:grid-cols-3`), pas de mismatch d'hydratation
```
