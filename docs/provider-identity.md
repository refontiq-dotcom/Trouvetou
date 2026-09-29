# Identité des providers

> `provider.id` est l'identité d'une **instance / client / connexion authentifiée**.
> `provider.type` désigne le **logiciel métier**.
> Ce ne sont pas la même chose, et les confondent produit des bugs.

Document de référence. Voir aussi `docs/sync-contract.md` pour le contrat de
synchronisation.

---

## Anatomie

```text
Provider
├── id                              identité stable de l'instance / client / connexion
├── type                            logiciel métier (sejoura, schooly, …)
├── name                            libellé libre — n'est PAS une clé de résolution
├── category_id                     secteur d'activité (hôtel, école, …)
├── api_key_hash                    credential ENTRANT  (provider → Trouvetou)
│                                   HMAC-SHA256, jamais la clé en clair
├── outbound_api_key_encrypted      credential SORTANT (Trouvetou → provider)
│                                   AES-256-GCM, récupérable
└── webhook_url                     URL de notification (optionnel)
```

---

## Règle 1 — `provider.id` n'est pas le logiciel métier

Un provider est **une connexion authentifiée**, pas un programme.

```
provider.id = a5101284-…      ← CETTE instance
provider.type = 'sejoura'     ← CE logiciel
```

`name` est un libellé affiché. Il ne sert à rien pour résoudre quoi que ce soit,
et deux providers peuvent porter le même `name`.

---

## Règle 2 — Plusieurs providers partagent le même `type`

C'est **normal**, pas une anomalie :

```text
provider A → type = 'sejoura'   (hôtel GAGE)
provider B → type = 'sejoura'   (hôtel Dady)
provider C → type = 'schooly'   (école X)
```

`type` sert à choisir un **adapter** (`ProviderRegistry`). `id` sert à identifier
une **connexion**. Les deux se répètent indépendamment.

Aucun `UNIQUE` n'est posé sur `type` : c'est délibéré.

---

## Règle 3 — d'où vient le `provider_id`

Il est extrait de **l'identité authentifiée de la connexion** :

```text
Clé API entrante :  tv_live_<providerId>.<secret>
                          └──┬──┘
                    provider_id

parseProviderIdFromKey()  →  SELECT providers WHERE id = providerId
```

Il n'est **jamais** déduit de :

| Source | Autorisé ? |
|---|---|
| Clé API de la connexion | ✅ **seule source** |
| Nom de l'établissement | ❌ |
| `providers.name` | ❌ |
| Titre d'un listing | ❌ |
| `webhook_url` | ❌ |
| `providers.type` | ❌ |
| `external_id` d'un listing | ❌ |

Conséquence : si `provider_id` est faux, c'est que **la clé API est fausse ou
réutilisée**, pas qu'un nom a été mal orthographié.

---

## Règle 4 — le sync ne crée jamais de provider

`POST /api/v1/sync` **reconnaît** un provider, il ne l'enregistre pas.

La création est une opération d'opérateur explicite
(`scripts/create-provider.mjs`), qui génère un `randomUUID()` et un secret
aléatoire de 32 octets.

Un sync ne peut donc pas créer d'instance par inadvertance — mais il peut
**écrire dans le mauvais provider** si on lui fournit une clé déjà utilisée.

---

## Règle 5 — l'identité d'une annonce

```text
(provider_id, external_id)
```

garanti par la contrainte `UNIQUE (provider_id, external_id)`.

- Même provider + même `external_id` → mise à jour, jamais de doublon.
- Provider différent + même `external_id` → **deux annonces distinctes** (légitime :
  deux établissements peuvent utiliser le même identifiant métier chez eux).

---

## ⚠️ Piège connu : un provider avec plusieurs credentials sortants

Le modèle veut **un credential sortant par provider**. Un état où un même
provider porte plusieurs `sejoura_api_key` distincts dans ses listings est donc
**anormal** — mais il ne doit pas être traité comme un bug de données tant que
la règle métier n'est pas connue.

Vérifier l'état d'un provider (aucun secret affiché) :

```sql
SELECT p.id, p.name, p.type,
  count(DISTINCT l.attributes->>'sejoura_api_key')
    FILTER (WHERE l.attributes ? 'sejoura_api_key') AS credentials_distincts
FROM providers p
LEFT JOIN listings l ON l.provider_id = p.id
GROUP BY p.id, p.name, p.type
ORDER BY credentials_distincts DESC NULLS LAST;
```

`credentials_distincts > 1` signale un provider à investiguer **avant** de lancer
une migration de credentials — pas une corruption à corriger automatiquement.

Le credential sortant est stocké sur `providers` (`outbound_api_key_encrypted`).
Le `listings.attributes.sejoura_api_key` n'est qu'un **fallback de compatibilité**,
en cours de migration. Tant qu'il existe, il reste lu en second : voir
`src/lib/credentials/resolver.ts`.

---

## Ce qu'il ne faut PAS faire

- ❌ Déduire le type d'un provider de son `name` (les deux sont libres)
- ❌ Considérer deux providers de même `type` comme un doublon
- ❌ Réaffecter `provider_id` d'un listing pour « ranger » les données
- ❌ Partir du nom d'un établissement pour décider de qui il est

---

## Voir aussi

- `docs/sync-contract.md` — le contrat de synchronisation (snapshot complet)
- `supabase/schema.sql` — table `providers` et `provider_type`
