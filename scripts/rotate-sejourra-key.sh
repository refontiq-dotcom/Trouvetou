#!/usr/bin/env bash
# ============================================================================
# Trouvetou — Rotation de la clé API d'un provider Séjour@ (via le Control Center)
#
#   REFONTIQ_CONTROL_CENTER_SECRET=… bash scripts/rotate-sejourra-key.sh <providerId>
#
# <providerId> est OBLIGATOIRE. Le script ne choisit JAMAIS un provider à la
# place de l'opérateur : depuis la séparation des tenants, plusieurs providers
# Séjour@ coexistent, et cibler le mauvais révoquerait la clé d'un autre client.
# En cas d'ambiguïté, l'endpoint répond `409 AMBIGUOUS_PROVIDER` — le script le
# remonte tel quel, sans trancher.
#
# Produit une NOUVELLE clé `tv_live_<uuid>.<secret>` et réaligne
# `providers.api_key_hash` sur le pepper actuellement déployé — le seul moyen de
# débloquer une clé devenue invalide (pepper changé, clé régénérée, ou hash
# jamais réaligné après la fusion des providers).
#
# La clé n'est affichée qu'une fois. À poser immédiatement dans :
#   1. Séjour@ local  → /home/dukoua/Projets/Séjourra/.env.local
#   2. Vercel projet sejoura-lemon → Environment Variables → TROUVETOU_API_KEY
#   3. redéployer sejoura-lemon (les env ne s'appliquent qu'au build suivant)
#
# ATTENTION : l'ancienne clé est INVALIDÉE dès l'appel. Toute instance Séjour@
# qui l'utilisera cessera de publier.
# ============================================================================
set -euo pipefail

APP_URL="${TROUVERTOU_APP:-https://trouvetou.vercel.app}"
ENDPOINT="$APP_URL/api/internal/control-center/trouvetou-key"
SECRET="${REFONTIQ_CONTROL_CENTER_SECRET:-}"

# ── Cible obligatoire ────────────────────────────────────────────────────────
PROVIDER_ID="${1:-}"

if [ -z "$PROVIDER_ID" ]; then
  cat >&2 <<'EOF'
Usage : bash scripts/rotate-sejourra-key.sh <providerId>

Argument MANQUANT : aucun provider n'est ciblé.

Ce script ne devine pas. Après la séparation des tenants, plusieurs providers
Séjour@ sont actifs ; pivoter une clé sans savoir lequel révoquerait la clé d'un
autre client.

Pour lister les providers Séjour@ actifs (lecture seule) :

  SELECT p.id, p.name, count(l.id) AS listings
  FROM providers p
  LEFT JOIN listings l ON l.provider_id = p.id
  WHERE p.type = 'sejoura' AND p.is_active
  GROUP BY p.id, p.name
  ORDER BY p.created_at;

EOF
  exit 64
fi

if [ -z "$SECRET" ]; then
  cat >&2 <<'EOF'
Variable REFONTIQ_CONTROL_CENTER_SECRET absente.

Cette valeur est rangée dans Vercel → projet Trouvetou → Settings →
Environment Variables. Elle n'est dans aucun .env local (volontairement :
c'est un secret d'infrastructure).

Récupère-la, puis :

  REFONTIQ_CONTROL_CENTER_SECRET='…' bash scripts/rotate-sejourra-key.sh <providerId>
EOF
  exit 1
fi

echo "→ Rotation de la clé Séjour@ pour le provider $PROVIDER_ID sur $APP_URL"

# Le providerId est transmis tel quel dans le corps JSON. Aucune recherche par
# nom n'est effectuée ici, et aucun repli n'est appliqué si la cible échoue :
# une réponse d'erreur doit rester une erreur, jamais devenir un autre provider.
response="$(timeout 30 curl -s -m 25 -X POST "$ENDPOINT" \
  -H "x-refontiq-control-center-secret: $SECRET" \
  -H 'Content-Type: application/json' \
  -d "{\"providerId\":\"$PROVIDER_ID\"}" 2>/dev/null || true)"

if printf '%s' "$response" | grep -q '"success":true'; then
  new_key="$(printf '%s' "$response" | sed -n 's/.*"apiKey":"\([^"]*\)".*/\1/p')"
  provider="$(printf '%s' "$response" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"

  # Garde-fou : l'endpoint a bien pivoté sur le provider demandé. Un écart
  # signifierait qu'une sélection implicite a eu lieu — on refuse de poursuivre.
  if [ "$provider" != "$PROVIDER_ID" ]; then
    echo "ERREUR : la rotation a porté sur $provider au lieu de $PROVIDER_ID. Abandon." >&2
    exit 70
  fi

  cat <<EOF

  Succès — provider $provider

  NOUVELLE CLÉ (affichée une seule fois) :
  $new_key

  Étapes obligatoires, dans l'ordre :
    1. echo 'TROUVETOU_API_KEY=$new_key' >> /home/dukoua/Projets/Séjourra/.env.local
    2. Vercel → projet sejoura-lemon → Environment Variables →
       TROUVETOU_API_KEY = <la clé ci-dessus> → Save
    3. Redeployer sejoura-lemon
    4. Tester la clé :
         curl -s -X POST $APP_URL/api/v1/sync \
           -H 'Content-Type: application/json' \
           -H "x-trouvetou-api-key: <la clé ci-dessus>" \
           -d '{"items":[]}'
       → attendu : erreur de payload (items non vide), PAS « Clé API invalide »
    5. Lancer la synchronisation :
         curl -X POST https://sejoura-lemon.vercel.app/api/trouvetou/sync \
           -H "x-sync-secret: \$TROUVETOU_SYNC_SECRET"
    6. Contrôler :
         bash /home/dukoua/Projets/Séjourra/scripts/check-trouvetou-sync.sh

  ATTENTION : l'ancienne clé de CE provider est INVALIDÉE dès maintenant.
  Seules les instances Séjour@ qui l'utilisaient cesseront de publier.
EOF
else
  echo "Échec de la rotation pour le provider $PROVIDER_ID." >&2
  # Message brut de l'endpoint : AMBIGUOUS_PROVIDER / PROVIDER_INACTIVE /
  # PROVIDER_TYPE_MISMATCH / PROVIDER_NOT_FOUND y sont déjà explicites.
  printf '%s\n' "${response:0:600}" >&2
  exit 1
fi
