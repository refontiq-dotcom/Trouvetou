# Trouvetou

Portail public d'annonces multi-secteur (hôtels, résidences meublées, écoles,
cliniques, restaurants). Consomme une base Supabase **dédiée** (catégories,
providers, listings polymorphes) ainsi que des intégrations partenaires, dont
**Schooly** pour la réservation en ligne d'écoles.

## Stack

- Next.js 16 (App Router, React 19, TypeScript)
- Tailwind CSS 4
- Supabase (lecture publique + ingestion serveur)
- Framer Motion, Lucide, Swiper

## Démarrage

```bash
npm install
cp .env.example .env.local   # compléter SCHOOLY_API_URL + TROUVETOU_API_KEY_PEPPER
npm run dev
```

## Tests

```bash
npm run typecheck
npm run test
npm run lint
```

## Intégration Schooly (écoles partenaires)

Schooly est la source de vérité pour les établissements scolaires. Trouvetou
expose le portail `/ecoles/partenaires` qui :

- affiche le catalogue des écoles publiées (`GET /api/trouvetou` côté Schooly) ;
- montre la fiche d'une école avec ses niveaux et places disponibles ;
- crée un dossier `pending_payment` (`POST /api/trouvetou` côté Schooly) ;
- confirme le paiement (`POST /api/trouvetou/reservations/:id/payment` côté Schooly).

### Côté Trouvetou

| Route | Rôle |
|---|---|
| `src/lib/schooly/client.ts` | Client HTTP serveur (Bearer, AbortSignal timeout). |
| `src/lib/schooly/types.ts` | Types du contrat API. |
| `src/app/api/ecoles/route.ts` | `GET /api/ecoles` — proxy catalogue. |
| `src/app/api/ecoles/reservations/route.ts` | `POST /api/ecoles/reservations` — création de dossier. |
| `src/app/api/ecoles/reservations/[id]/payment/route.ts` | `POST .../payment` — confirmation de paiement. |
| `src/app/ecoles/partenaires/page.tsx` | Liste des écoles. |
| `src/app/ecoles/partenaires/[id]/page.tsx` | Fiche école. |
| `src/app/ecoles/partenaires/[id]/reserver/page.tsx` | Formulaire de réservation. |
| `src/app/ecoles/partenaires/[id]/confirmation/page.tsx` | Confirmation. |
| `src/components/ecoles/*.tsx` | UI dédiée (carte, formulaire, contenu). |

Le jeton Bearer (`TROUVETOU_API_KEY_PEPPER`) n'est **jamais** envoyé au
navigateur : toutes les requêtes Schooly passent par les routes internes
`/api/ecoles/*`.

### Configuration requise

```env
SCHOOLY_API_URL=https://schooly.example.com
TROUVETOU_API_KEY_PEPPER=<clé partagée avec Schooly>
```

Si la configuration est absente, la page `/ecoles/partenaires` affiche un
message clair et renvoie 503 sur `/api/ecoles*` — le reste de l'application
n'est pas impacté. La page `/ecoles` historique (catalogue générique via
`listings` Trouvetou) reste inchangée.

## Sécurité

- Clé Bearer **serveur uniquement** (jamais `NEXT_PUBLIC_*`).
- Validation côté serveur des champs requis avant tout appel Schooly.
- Timeout `AbortSignal.timeout(10s)` pour éviter les hangs.
- Erreurs Schooly normalisées (`SchoolyApiError` / `SchoolyConfigError`).
