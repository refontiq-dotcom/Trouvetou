# Contrat de synchronisation — Trouvetou

> **Trouvetou reçoit des SNAPSHOTS COMPLETS de l'état public du provider.
> Le Sync n'est PAS un PATCH. Le provider reste la source de vérité.
> Trouvetou est le miroir public et l'index de recherche.**
> **Les credentials techniques sont hors du miroir public.**

Ce document est la référence normative pour tout connecteur entrant dans
Trouvetou. En cas d'ambiguïté, c'est ce document qui fait foi, et non
l'implémentation.

- **Endpoint** : `POST /api/v1/sync`
- **Authentification** : en-tête `x-trouvetou-api-key` (ou `Authorization`),
  format `tv_live_<providerId>.<secret>`
- **Implémentation** : `src/app/api/v1/sync/route.ts` + fonction SQL
  `ingest_listings`

---

## 1. Source de vérité et responsabilité

Le **provider / SaaS métier est la source de vérité** de ses données métier.
Trouvetou n'est PAS la base métier du provider : il n'a ni les factures, ni
l'inventaire, ni les clients, ni le calendrier du provider.

Trouvetou conserve uniquement ce qui est nécessaire à sa mission propre :

| Besoin | Exemple de donnée conservée |
|---|---|
| Recherche et catalogue public | titre, description, catégorie, ville |
| Affichage | photos, attributs de présentation |
| Géolocalisation | latitude, longitude |
| Prix public | `base_price` |
| Publication | `is_available` |
| Orchestration des actions | identifiants techniques (`external_id`) |

Tout le reste reste chez le provider. Si une donnée n'est nécessaire qu'à la
décision métier d'un SaaS, elle n'a rien à faire dans Trouvetou.

---

## 2. Un Sync est un snapshot complet

**Règle centrale.** Un appel réussi représente *l'état complet, à cet instant,
des annonces publiques que le provider souhaite exposer sur Trouvetou*.

Ce n'est **PAS** :

- un PATCH ;
- une mise à jour partielle ;
- une liste de champs à fusionner avec l'état précédent ;
- une notification de changements.

### Exemple

État en base après le snapshot n°1 :

```text
external_id = "room-42"
title       = "Suite Deluxe"
base_price  = 50000
images      = [a.jpg, b.jpg]
attributes  = { beds: 2, capacity: 4 }
```

Le provider envoie ensuite son snapshot n°2, où la chambre a été requalifiée :

```text
external_id = "room-42"
title       = "Suite Standard"
base_price  = 35000
images      = [c.jpg]
attributes  = { beds: 1 }
```

**Après le snapshot n°2, l'état en base est EXACTEMENT celui-ci.** `capacity: 4`
et les photos `a.jpg`/`b.jpg` ont disparu : ils ne font plus partie de l'état
public, donc Trouvetou ne les réinvente pas.

### Pourquoi ce choix

Conserver automatiquement les champs absents rend l'état en base **non
reconstructible** : deux providers qui envoient le même contenu de façon
différente produiraient deux états différents, et un bug côté provider
(champ oublié) deviendrait invisible au lieu d'être corrigé.

Le miroir a une propriétéfundamentalement simple : **ce qui est en base est ce
que le provider a dit, ni plus ni moins.** Un opérateur peut donc comparer la
base au système source et comprendre l'écart.

---

## 3. Champs omis

**Un champ public optionnel absent d'un snapshot signifie : cette valeur n'est
plus fournie dans l'état public actuel.**

Elle est donc traitée comme une valeur absente (`NULL` en base, tableau vide,
objet vide) — jamais comme « conserver l'ancienne valeur ».

La seule exception est un **mécanisme technique protégé explicitement** : voir
§4 sur les credentials. Le provider n'a pas à envoyer ces données techniques
pour que Trouvetou les conserve.

---

## 4. Exception : les credentials sont hors du miroir public

Les credentials techniques **ne font pas partie de l'état public d'un listing**.

En particulier, `listings.attributes.sejoura_api_key` est une **dette de
compatibilité historique**, et non une donnée publique d'annonce. Un provider
n'a donc aucune obligation de l'envoyer.

Mécanisme en place (Phase 2D.1) : si un snapshot ne contient pas cette clé,
**la valeur existante est préservée**. Ce comportement est protégé dans
`ingest_listings` lui-même, pas dans la route, et il ne doit pas être
contourné.

La source de vérité du credential sortant est désormais
`providers.outbound_api_key_encrypted` (chiffré en AES-256-GCM).

> Ne supprimez pas ce mécanisme lors d'un nouveau connecteur : c'est lui qui
> empêche qu'un snapshot incomplet casse les réservations en cours.

---

## 5. Annonces absentes du snapshot

Si un snapshot complet est reçu et qu'une annonce existante du même provider
**n'y figure plus**, elle est considérée comme retirée de l'état public :

```
is_available = false
```

**La ligne en base et son identité sont conservées.** Rien n'est supprimé
physiquement. Conséquence : le cycle

```
publish → unpublish → republish
```

reutilise toujours le même couple `(provider_id, external_id)` et ne crée
jamais d'identité supplémentaire.

---

## 6. Identité d'un listing

L'identité est le TRIPLET :

```
(provider_id, tenant_ref, external_id)
```

et **jamais** `external_id` seul, ni le couple `(provider_id, external_id)`.

> **Phase 2D.39.** `provider` est une **connexion SaaS authentifiée**, pas un
> établissement. Un même provider sert donc plusieurs tenants, et deux tenants
> peuvent légitimement utiliser le même `external_id`. La contrainte
> `UNIQUE (provider_id, external_id)` a été remplacée par
> `UNIQUE (provider_id, tenant_ref, external_id)`, en `NULLS NOT DISTINCT`
> afin qu'un listing legacy sans `tenant_ref` reste unique par
> `(provider_id, external_id)`.
>
> `tenant_ref` est un identifiant **technique** fourni par le SaaS source. Il
> n'est pas retourné par le catalogue : `LISTINGS_SELECT` énumère ses colonnes.

| Cas | Résultat |
|---|---|
| Mêmes provider ET tenant + `"123"` | **Un** seul listing, mis à jour |
| Provider A + `"123"` puis Provider B + `"123"` | **Deux** listings distincts |
| Provider P, tenant A + `"X"` puis Provider P, tenant B + `"X"` | **Deux** listings distincts |

Deux providers différents peuvent légitimement utiliser le même
`external_id`. C'est `provider_id` qui les sépare.

`external_id` est l'identifiant de la ressource **chez le provider**. Sa forme
appartient au connecteur : `rt:<uuid>` pour Séjour@, `school-1` pour une école,
`tbl_42` pour un restaurant. Le cœur ne l'interprète jamais.

---

## 7. Idempotence

Rejouer un snapshot identique est sans effet :

```
SYNC #1 → SYNC #1 → SYNC #1
```

ne crée pas de nouveaux listings. La contrainte `UNIQUE (provider_id, tenant_ref,
external_id)` est la garantie finale : un doublon est **rejeté par la base**,
pas évité par convention applicative.

L'upsert est atomique (`ON CONFLICT ... DO UPDATE`) : chaque item est inséré
ou mis à jour, jamais dupliqué.

---

## 8. Atomicité du lot

**Le lot est accepté entièrement ou rejeté entièrement.**

Si un seul item viole une contrainte, l'intégralité de la transaction est
annulée : aucun item valide du même lot ne reste écrit.

C'est la conséquence directe de l'exécution de tous les items dans une seule
fonction PL/pgSQL, donc d'une seule transaction implicite.

Avant l'appel, la route valide également l'ensemble du lot et renvoie
`VALIDATION_FAILED` avec le détail par item si l'erreur est détectable sans
écrire.

---

## 9. Contrat minimal du payload

### Structure

```json
{ "items": [ { "...": "une annonce" } ] }
```

### Champs obligatoires

Seuls deux champs sont réellement exigés par le code aujourd'hui :

| Champ | Règle |
|---|---|
| `external_id` | Chaîne non vide. **Identité de la ressource chez le provider.** |
| `title` | Chaîne non vide (`chk_title_not_empty` en base). |

### Champs optionnels

Tous les autres ; leur absence suit la règle du §3.

| Champ | Type | Comportement si absent |
|---|---|---|
| `description` | `string \| null` | `NULL` |
| `city` | `string \| null` | `NULL` |
| `base_price` | `number \| string \| null` | `NULL` |
| `images` | `string[]` | `[]` |
| `attributes` | `object` | `{}` |
| `category_slug` | `string \| null` | catégorie du provider |
| `is_available` | `boolean \| null` | `true` |

### Contraintes appliquées

- **Médias** : ALLOWLISTE stricte `http:`/`https:`. Les URL `javascript:`,
  `data:`, relatives ou protocol-relative sont **écartées silencieusement**.
  Dédupliquées, puis limitées à 4 par annonce.
- **`attributes`** : doit être un objet JSON ; un tableau ou un scalaire est
  ramené à `{}`.
- **`category_slug`** : résolu par `categories.slug` ; inconnu → catégorie du
  provider.

---

## 10. Règle pour les futurs connecteurs

**Un connecteur doit envoyer un snapshot complet de son état public, pas
seulement les éléments modifiés.**

✅ **Correcte**

```http
POST /api/v1/sync

{
  "items": [
    { "external_id": "A", "title": "Suite Deluxe",  "base_price": 50000, "images": [...] },
    { "external_id": "B", "title": "Studio",       "base_price": 32000, "images": [...] },
    { "external_id": "C", "title": "Suite Famille","base_price": 45000, "images": [...] }
  ]
}
```

❌ **Incorrecte**, si le sens voulu est « modifie seulement le prix de A et
conserve tout le reste » :

```http
POST /api/v1/sync

{
  "items": [
    { "external_id": "A", "base_price": 35000 }
  ]
}
```

Ce second comportement correspond à un PATCH/merge, **qui n'est pas le contrat
actuel**. Il produirait ici une annonce A sans titre (rejetée par la
validation), et pour les champs optionnels une perte de données.

Si un jour un besoin de synchronisation incrémentale apparaît, il fera l'objet
d'**une décision d'architecture séparée**, avec un endpoint distinct. Ne pas
introduire de `sync_mode`, `partial` ou `merge` dans le contrat actuel.

---

## 11. Résumé pour l'implémenteur

| Question | Réponse |
|---|---|
| Le provider est-il la source de vérité ? | **Oui**, toujours. |
| Le Sync est-il un PATCH ? | **Non.** Snapshot complet. |
| Un champ absent est-il conservé ? | **Non**, sauf credential protégé. |
| Une annonce absente est-elle supprimée ? | **Non**, désactivée (`is_available=false`). |
| Quelle est l'identité d'un listing ? | `(provider_id, external_id)`. |
| Deux providers peuvent-ils partager un `external_id` ? | **Oui**, deux listings distincts. |
| Le Sync est-il idempotent ? | **Oui**, la base garantit l'unicité. |
| Le lot est-il atomique ? | **Oui**, accepté ou rejeté en entier. |
| Faut-il envoyer `sejoura_api_key` ? | **Non**, mécanisme de compatibilité. |
| Comment signaler une erreur de sync ? | Réponse HTTP + `sync_logs` (par lot). |

