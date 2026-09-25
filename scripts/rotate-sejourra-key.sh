#!/usr/bin/env bash
# ============================================================================
# Trouvetou — Rotation de la clé API du provider Séjour@ (via le Control Center)
#
#   REFONTIQ_CONTROL_CENTER_SECRET=… bash scripts/rotate-sejourra-key.sh
#
# Produit une NOUVELLE clé `tv_live_<uuid>.<secret>` et réaligne
# `providers.api_key_hash` sur le pepper actuellement déployé — le seul moyen de
# débloquer une clé devenue invalide (pepper changé, clé régénérée, ou hash
# jamais réaligné après la fusion des providers).
#
# La clé n'est affichée qu'une fois. À poser immédiatement dans :
#   1. Séjour@ local  → /home/dukoua/Projets/Séjoura/.env.local
#   2. Vercel projet sejoura-lemon → Environment Variables → TROUVETOU_API_KEY
#   3. redéployer sejoura-lemon (les env ne s'appliquent qu'au build suivant)
# ============================================================================
set -euo pipefail

APP_URL="${TROUVERTOU_APP:-https://trouvetou.vercel.app}"
ENDPOINT="$APP_URL/api/internal/control-center/trouvetou-key"
SECRET="${REFONTIQ_CONTROL_CENTER_SECRET:-}"

if [ -z "$SECRET" ]; then
  cat >&2 <<'EOF'
Variable REFONTIQ_CONTROL_CENTER_SECRET absente.

Cette valeur est rangée dans Vercel → projet Trouvetou → Settings →
Environment Variables. Elle n'est dans aucun .env local (volontairement :
c'est un secret d'infrastructure).

Récupère-la, puis :

  REFONTIQ_CONTROL_CENTER_SECRET='…' bash scripts/rotate-sejourra-key.sh
EOF
  exit 1
fi

echo "→ Rotation de la clé Séjour@ sur $APP_URL"
response="$(timeout 30 curl -s -m 25 -X POST "$ENDPOINT" \
  -H "x-refontiq-control-center-secret: $SECRET" 2>/dev/null || true)"

if printf '%s' "$response" | grep -q '"success":true'; then
  new_key="$(printf '%s' "$response" | sed -n 's/.*"apiKey":"\([^"]*\)".*/\1/p')"
  provider="$(printf '%s' "$response" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  cat <<EOF

  Succès — provider $provider

  NOUVELLE CLÉ (affichée une seule fois) :
  $new_key

  Étapes obligatoires, dans l'ordre :
    1. echo 'TROUVETOU_API_KEY=$new_key' >> /home/dukoua/Projets/Séjoura/.env.local
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
         bash /home/dukoua/Projets/Séjoura/scripts/check-trouvetou-sync.sh

  ATTENTION : l'ancienne clé est INVALIDÉE dès maintenant. Toute instance
  Séjour@ qui l'utilisera cessera de publier.
EOF
else
  echo "Échec de la rotation." >&2
  echo "Réponse : ${response:0:400}" >&2
  exit 1
fi
