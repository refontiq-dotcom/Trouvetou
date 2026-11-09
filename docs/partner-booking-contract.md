# Contrat d'intégration des réservations partenaires — Trouvetou

## Objectif

Tout projet Refontiq connecté à Trouvetou doit implémenter le même contrat serveur-à-serveur. Les règles métier et les schémas de chaque produit restent dans leur plateforme propriétaire ; Trouvetou orchestre le parcours et ne lit jamais directement la base du partenaire.

## Authentification

- Synchronisation vers Trouvetou : `x-trouvetou-api-key: tv_live_<providerId>.<secret>`.
- Le `TROUVETOU_API_KEY_PEPPER` de Trouvetou sert uniquement à calculer/vérifier les empreintes HMAC des clés provider. Il ne doit jamais être envoyé à un partenaire ni accepté comme clé d'API.
- Appels de réservation depuis Trouvetou : `x-trouvetou-booking-secret: <secret>`.
- Chaque partenaire possède un secret dédié. Dans Trouvetou, le nom de variable suit `TROUVETOU_BOOKING_SECRET_<PROVIDER_SLUG>` (par exemple `TROUVETOU_BOOKING_SECRET_SCHOOLY`). Le secret correspondant est configuré côté serveur du partenaire.
- Aucun secret, token ou clé API ne doit figurer dans `listings.attributes`, le payload de catalogue, les URLs ou le navigateur.
- Les secrets sont comparés en temps constant côté partenaire. Les routes doivent échouer fermées si le secret manque.

## Contrat fonctionnel

Chaque adaptateur partenaire doit exposer, selon les capacités de son domaine :

1. **Availability** : vérifier la disponibilité réelle pour les dates / ressources choisies. Le catalogue n'est jamais une source de disponibilité garantie.
2. **Create request** : créer une demande ou réservation en attente côté système propriétaire.
3. **Confirm payment** : confirmer côté partenaire uniquement après validation du paiement par le serveur / webhook du prestataire.
4. **Cancel / expire** : annuler ou expirer selon les règles métier du partenaire.
5. **Status lookup** : permettre de retrouver l'état d'une demande sans créer une seconde réservation.

Les adaptateurs sont spécifiques au domaine (hébergement, inscription scolaire, clinique, etc.). Ne pas forcer tous les partenaires à utiliser le même payload métier.

## Idempotence obligatoire

- Trouvetou génère un UUID `idempotency_key` stable pour une tentative de réservation et le réutilise pour tous les retries.
- Le partenaire doit garantir qu'une même clé, dans le périmètre de son tenant / établissement, retourne la réservation initiale au lieu d'en créer une autre.
- Une contrainte unique en base doit protéger la concurrence ; un simple contrôle préalable en code ne suffit pas.
- Les paiements et callbacks doivent aussi être dédupliqués par référence fournisseur.

## Erreurs standard

- `400` : payload invalide.
- `401` : secret absent ou invalide.
- `403` : partenaire / établissement non autorisé ou non actif.
- `404` : annonce ou ressource introuvable.
- `409` : disponibilité épuisée, conflit ou réservation déjà traitée.
- `503` : intégration non configurée.
- `502` : partenaire temporairement indisponible.

## Checklist avant d'activer un nouveau partenaire

- [ ] Provider créé et actif dans Trouvetou.
- [ ] Clé de synchronisation distincte du secret de réservation.
- [ ] Secret de réservation dédié configuré côté Trouvetou et partenaire.
- [ ] Données sensibles absentes des annonces.
- [ ] Availability et create testés avec mocks / environnement de test.
- [ ] Idempotence et concurrence testées.
- [ ] Confirmation de paiement déclenchée uniquement par preuve serveur.
- [ ] Annulation / expiration et récupération de statut testées.
- [ ] Documentation du contrat et tests d'adaptateur ajoutés.

## Intégrations existantes

- **Séjoura** : adaptateur hébergement historique ; secret dédié résolu par le helper commun, avec compatibilité temporaire pour `TROUVETOU_BOOKING_SHARED_SECRET`.
- **Schooly** : le catalogue et l'adaptateur de demande de place sont raccordés. Trouvetou récupère la disponibilité, transmet une demande idempotente à Schooly et confirme au parent sa réception. Le statut `requested` ne bloque pas une place ; aucun paiement en ligne ni inscription définitive n'est déclenché. La famille poursuit l'inscription directement auprès de l'école.
