# Trouvetou

Portail public de petites annonces — **Trouvez tout, restez serein.**

Application Next.js (App Router) ultra-fluide, moderne et responsive qui référence
**hôtels & résidences meublées, cliniques et écoles**. Trouvetou est un
**comparateur multi-secteur indépendant** : il possède **sa propre base de
données Supabase**, distincte de Séjoura, et **agrège les annonces envoyées par
différentes API métiers** (Séjoura pour les hôtels, un PMS pour les cliniques,
un SIS pour les écoles, etc.).

## Stack technique

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Tailwind CSS 4** (design épuré, cartes arrondies, ombres douces)
- **Lucide React** (icônes)
- **Framer Motion** (micro-animations au survol, modals fluides)
- **Supabase** (`@supabase/supabase-js`) — base **dédiée** Trouvetou

## Architecture — Découplage de Séjoura

Trouvetou ne lit plus directement la base de Séjoura. Chaque logiciel partenaire
pousse ses annonces vers la **couche d'ingestion** Trouvetou (`/api/v1/sync`),
qui valide la clé API du provider puis exécute un **UPSERT** dans la table
polymorphe `listings`.

```
┌─────────────┐      POST /api/v1/sync      ┌──────────────────────┐
│  Séjoura    │ ──────── X-API-Key ───────► │  Trouvetou (Next.js) │
│  (hôtels)   │        JSON batch           │   └─ Supabase dédiée │
└─────────────┘                             │       categories     │
┌─────────────┐                             │       providers      │
│  MediPMS    │ ──────────────────────────► │       listings       │
│  (cliniques)│                             │       sync_logs      │
└─────────────┘                             └──────────┬───────────┘
┌─────────────┐                                        │ lecture anon
│  EduSoft    │ ──────────────────────────►            ▼
│  (écoles)   │                          Catalogue public (UI)
└─────────────┘
```

- **Base dédiée** : `supabase/schema.sql` crée les tables `categories`,
  `providers`, `listings` (polymorphe) et `sync_logs`.
- **Ingestion** : Route Handler `src/app/api/v1/sync/route.ts` — validation de
  la clé API du provider + UPSERT atomique sur le couple `(provider_id, external_id)`.
- **Lecture** : `src/lib/supabase/listings.ts` consomme `listings` (catalogue
  public en lecture seule, RLS `anon`).

## Pages

### `/` — Page d'accueil (Hub)

- Hero section : titre, sous-titre et barre de recherche globale.
- **3 cartes de modules affichées au premier écran** (2 colonnes sur mobile),
  une par univers — Hôtels & Résidences, Écoles & Établissements, Cliniques &
  Santé. Un clic mène directement au portail du module pour comparer les prix.
- Section « Comment ça marche » (2 colonnes sur mobile) et bande d'appel à
  l'action.

### `/hotels` — Hôtels & Résidences

- Cartes de chambres : image (CDN/Storage), nom, catégorie, prix en FCFA,
  spécificités (`attributes`) en badges/icônes.
- Bouton **Itinéraire** → Google Maps ; bouton **Réserver / Contacter** → modal
  avec les coordonnées du gérant.
- États de chargement (skeletons), état vide, gestion d'erreur, filtres et tri.
- Carrousel des annonces sponsorisées et tri « boosté » (annonces en tête).
- Pagination « Voir plus » (30 résultats par lot, 100 max).

### `/ecoles` — Écoles & Établissements Privés

Même portail générique que `/hotels`, configuré sur la catégorie `school` :
recherche, budget, tri, prix affiché **par scolarité**, carrousel sponsorisé.

### `/cliniques` — Cliniques & Santé

Même portail générique que `/hotels`, configuré sur la catégorie `clinic` :
recherche, budget, tri, prix affiché **par consultation**, carrousel sponsorisé.

Les trois portails partagent le composant `CatalogContent`
(`src/components/catalog/catalog-content.tsx`), paramétré par les configs de
`src/components/catalog/configs.ts`.

**Détection d'intention** : si une recherche ne correspond pas à l'univers du
portail courant (ex. « résidence » tapé sur `/ecoles`), le système le détecte
via des mots-clés (`src/lib/search-intent.ts`, comparaison insensible aux
accents) et affiche un message guidant l'utilisateur vers le bon portail,
en conservant sa requête.

## API d'ingestion — `/api/v1/sync`

### Endpoint

```
POST /api/v1/sync
x-trouvetou-api-key: tv_live_<providerId>.<secret>
Content-Type: application/json
```

La clé API est fournie à chaque logiciel partenaire lors de son enregistrement
(voir « Enregistrer un provider »). Seule son **empreinte HMAC-SHA256** est
stockée en base (`providers.api_key_hash`).

### Structure du JSON envoyé par Séjoura (ou tout autre PMS)

```json
{
  "items": [
    {
      "external_id": "room_type_7f3a21",
      "title": "Chambre Deluxe — Résidence Les Palmiers",
      "description": "Chambre climatisée avec balcon, wifi haut débit.",
      "city": "Abidjan",
      "base_price": 25000,
      "images": [
        "https://cdn.example.com/rooms/palmiers-deluxe-1.jpg",
        "https://cdn.example.com/rooms/palmiers-deluxe-2.jpg"
      ],
      "attributes": {
        "beds": 2,
        "wifi": true,
        "amenities": ["clim", "tv", "petit-dejeuner"]
      },
      "is_available": true
    },
    {
      "external_id": "room_type_8b10cc",
      "title": "Studio — Résidence Cocody",
      "city": "Abidjan",
      "base_price": 40000,
      "images": ["https://cdn.example.com/rooms/cocody-studio.jpg"],
      "attributes": { "beds": 1, "kitchen": true },
      "is_available": true
    }
  ]
}
```

**Exemple pour une clinique (même endpoint, provider différent) :**

```json
{
  "items": [
    {
      "external_id": "specialty_cardiologie",
      "title": "Consultation Cardiologie — Clinique Sainte-Marie",
      "description": "Consultation spécialisée, rendez-vous sous 48 h.",
      "city": "Abidjan",
      "base_price": 15000,
      "images": ["https://cdn.example.com/clinics/cardio.jpg"],
      "attributes": { "specialties": ["Cardiologie"], "doctor": "Dr Kouassi" },
      "is_available": true
    }
  ]
}
```

### Contrat

| Champ              | Type            | Requis | Description                                                        |
| ------------------ | --------------- | ------ | ------------------------------------------------------------------ |
| `items`            | `array`          | oui    | Lot d'annonces (1 à 500).                                           |
| `items[].external_id` | `string`       | oui    | ID **stable** côté fournisseur — clé de l'UPSERT avec `provider_id`.|
| `items[].title`     | `string`         | oui    | Titre de l'annonce.                                                 |
| `items[].description` | `string`       | non    | Description détaillée.                                              |
| `items[].city`      | `string`         | non    | Ville.                                                              |
| `items[].base_price`| `number`         | non    | Prix de base en FCFA (nuit / consultation / scolarité).             |
| `items[].images`    | `string[]`       | non    | Liens CDN/Storage.                                                  |
| `items[].attributes`| `object`         | non    | Spécificités du secteur (libre, JSONB).                             |
| `items[].is_available` | `boolean`     | non    | `true` par défaut. `false` masque l'annonce du catalogue.           |

**Réponses** : `200` (succès avec `inserted` / `updated`), `401` (clé invalide),
`403` (provider désactivé), `400` (payload invalide), `413` (lot trop gros).
Chaque appel est tracé dans `sync_logs`.

> **Synchronisation** : pour désactiver une annonce côté catalogue, renvoyez-la
> avec `is_available: false` (UPSERT) plutôt que de l'omettre — l'annonce reste
> ainsi connue et historisée.

## Déploiement

### 1. Créer le projet Supabase dédié Trouvetou

1. Créez un **nouveau projet** Supabase (indépendant du projet Séjoura).
2. Ouvrez **SQL Editor** et exécutez l'intégralité du fichier
   `supabase/schema.sql` : tables `categories`, `providers`, `listings`,
   `sync_logs`, RLS, fonctions (`ingest_listings`, `create_provider`) et les
   catégories initiales (`hotel`, `residence`, `clinic`, `school`, `other`).
3. Renseignez les variables d'environnement (voir `.env.example`) :
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — lecture du
     catalogue public (rôle `anon`, RLS lecture seule) ;
   - `TROUVETOU_SUPABASE_URL` / `TROUVETOU_SUPABASE_SERVICE_ROLE_KEY` —
     **côté serveur uniquement** pour l'ingestion ;
   - `TROUVETOU_API_KEY_PEPPER` — secret HMAC (≥ 32 caractères), **identique**
     entre le serveur et le script d'enregistrement.

### 2. Enregistrer un provider (Séjoura, PMS, SIS…)

```bash
# Depuis /trouvetou, après `npm install` et configuration du .env.local
node scripts/create-provider.mjs "Séjoura" hotel \
  --webhook https://sejoura.app/sync-callback
```

Le script affiche **une seule fois** la clé API du provider
(`tv_live_<providerId>.<secret>`) à transmettre au logiciel partenaire.
Un provider = une clé = une catégorie (`hotel`, `clinic`, `school`, ...).

### 3. Configurer Séjoura pour envoyer ses annonces

Séjoura construit le JSON ci-dessus (une entrée par type de chambre publié) et
l'envoie en `POST` vers `https://trouvetou.app/api/v1/sync` avec l'en-tête
`x-trouvetou-api-key`, à chaque modification d'une chambre ou selon un
intervalle régulier (ex. toutes les 15 min via un cron).

### 4. Démarrage local

```bash
npm install
npm run dev     # http://localhost:3000
```

## Schéma de données

### Tables (base dédiée Trouvetou)

| Table       | Rôle                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `categories`| Secteurs isolés par slug : `hotel`, `residence`, `clinic`, `school`, `other`. |
| `providers` | Sources d'alimentation : `name`, `category_id`, `api_key_hash` (HMAC), `webhook_url`, `is_active`. |
| `listings`  | Annonces polymorphes : `external_id`, `title`, `description`, `city`, `base_price`, `images[]`, `attributes JSONB`, `is_available`. `UNIQUE(provider_id, external_id)`. |
| `sync_logs` | Journal d'audit des synchronisations (`status`, `inserted`, `updated`). |

`attributes JSONB` porte la spécificité du secteur :

- hôtel : `{ "beds": 3, "wifi": true, "amenities": ["clim"] }`
- clinique : `{ "specialties": ["Cardiologie", "Dermatologie"] }`
- école : `{ "levels": ["Maternelle", "Primaire"], "language": "fr" }`

### Sécurité

- RLS : rôle `anon` en **lecture seule** sur `categories` et `listings`
  (annonces `is_available = true`) ; `providers` et `sync_logs` inaccessibles
  à `anon`.
- L'ingestion passe par la clé `service_role` (contourne RLS) côté serveur.
- Les clés API des providers ne sont jamais stockées en clair (empreinte
  HMAC-SHA256 + pepper), comparées en temps constant.

## Scripts

```bash
npm run dev      # Serveur de développement (Turbopack)
npm run build    # Build de production
npm run start    # Serveur de production
npm run lint     # ESLint (flat config)
```

## Fichiers clés

- `supabase/schema.sql` — migration SQL complète (base dédiée Trouvetou).
- `src/app/api/v1/sync/route.ts` — couche d'ingestion multi-sources.
- `src/lib/sync/api-key.ts` — génération/hash des clés API (timing-safe).
- `src/lib/supabase/admin.ts` — client `service_role` (serveur uniquement).
- `src/lib/supabase/listings.ts` — lecture du catalogue public.
- `scripts/create-provider.mjs` — enregistrement d'un provider partenaire.
- `src/lib/supabase/database.types.ts` — types TypeScript de la base dédiée.
