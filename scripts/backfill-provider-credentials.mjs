#!/usr/bin/env node
// ============================================================================
// TROUVETOU — Backfill du credential SORTANT au niveau du provider
//
//   node scripts/backfill-provider-credentials.mjs [--dry-run]
//
// Copie le secret stocké dans `listings.attributes.sejoura_api_key` vers
// `providers.outbound_api_key_encrypted`, CHIFFRÉ, une fois par provider.
//
// La clé de chiffrement n'est pas accessible depuis une migration SQL : le
// backfill se fait ici, côté application, là où le module de chiffrement
// existe.
//
// RÈGLES ABSOLUES
//
// 1. Seuls les providers `type = 'sejoura'`. Aucune inférence depuis `name`,
//    `category_id`, `webhook_url` ni `external_id`.
// 2. Provider sans credential legacy : rien à faire, on n'invente rien.
// 3. UN SEUL credential distinct : on chiffre et on écrit.
// 4. PLUSIEURS credentials distincts pour un même provider : CONFLIT. Le
//    script s'arrête et ne modifie rien. Choisir arbitrairement enverrait
//    une réservation au mauvais établissement.
// 5. Idempotent : un provider déjà pourvu n'est pas réécrit.
//
// SÉCURITÉ
//
// Aucune valeur de secret n'est JAMAIS affichée, y compris en cas d'échec.
// Les diagnostics portent sur la présence, le nombre et la comparaison. Le
// script est destiné à un poste d'opérateur dont la sortie peut être lue.
// ============================================================================

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Fichier absent : les variables viendront de l'environnement du shell.
  }
}

const { createClient } = await import("@supabase/supabase-js");
const { encryptCredential, isEncryptedCredential } = await import(
  "../src/lib/credentials/encryption.ts"
);

const DRY_RUN = process.argv.includes("--dry-run");

/** Attribut legacy qui porte le credential en clair. */
const LEGACY_ATTRIBUTE = "sejoura_api_key";

// ── Client Supabase (service_role : la lecture contourne la RLS) ────────────
const url = process.env.TROUVETOU_SUPABASE_URL;
const serviceRole = process.env.TROUVETOU_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error("Variables manquantes : TROUVETOU_SUPABASE_URL, TROUVETOU_SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY) {
  console.error("Variable manquante : TROUVETOU_CREDENTIAL_ENCRYPTION_KEY (64 caractères hexadécimaux).");
  console.error("Le backfill ne peut pas s'exécuter sans elle : rien ne peut être chiffré.");
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── 1. Providers concernés : type = 'sejoura', JAMAIS déduit du nom ────────
const { data: providers, error: providersError } = await supabase
  .from("providers")
  .select("id, name, type, outbound_api_key_encrypted")
  .eq("type", "sejoura")
  .order("name");

if (providersError) {
  console.error("Erreur lecture providers :", providersError.message);
  process.exit(1);
}

console.log(`Providers type='sejoura' : ${providers.length}`);

if (providers.length === 0) {
  console.log("Aucun provider concerné : rien à faire.");
  process.exit(0);
}

// ── 2. Collecte des credentials legacy, groupés par provider ──────────────
const { data: listings, error: listingsError } = await supabase
  .from("listings")
  .select("id, provider_id, attributes")
  .not("attributes", "is", null);

if (listingsError) {
  console.error("Erreur lecture listings :", listingsError.message);
  process.exit(1);
}

/** provider_id -> Set de credentials distincts. */
const credentialsByProvider = new Map();

for (const listing of listings ?? []) {
  const attributes = listing.attributes;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) continue;

  const legacy = attributes[LEGACY_ATTRIBUTE];
  if (typeof legacy !== "string" || legacy === "") continue;

  if (!credentialsByProvider.has(listing.provider_id)) {
    credentialsByProvider.set(listing.provider_id, new Set());
  }
  credentialsByProvider.get(listing.provider_id).add(legacy);
}

// ── 3. Rapport et décision, provider par provider ────────────────────────
const report = [];
const conflicts = [];
const toWrite = [];

for (const provider of providers) {
  const distinct = credentialsByProvider.get(provider.id);
  const distinctCount = distinct?.size ?? 0;
  const listingCount = (listings ?? []).filter((l) => l.provider_id === provider.id).length;

  const alreadyDone =
    typeof provider.outbound_api_key_encrypted === "string" &&
    provider.outbound_api_key_encrypted !== "" &&
    isEncryptedCredential(provider.outbound_api_key_encrypted);

  if (distinctCount === 0) {
    report.push({ id: provider.id, name: provider.name, listings: listingCount, distinct: 0, action: "aucun credential legacy" });
    continue;
  }

  if (distinctCount > 1) {
    // CONFLIT : on ne choisit pas. Sortie sans détail de valeurs.
    conflicts.push({ id: provider.id, name: provider.name, distinct: distinctCount, listings: listingCount });
    continue;
  }

  const [soleCredential] = [...distinct];
  if (alreadyDone) {
    report.push({ id: provider.id, name: provider.name, listings: listingCount, distinct: 1, action: "déjà backfillé (idempotent)" });
    continue;
  }

  toWrite.push({ id: provider.id, name: provider.name, credential: soleCredential });
  report.push({ id: provider.id, name: provider.name, listings: listingCount, distinct: 1, action: "à chiffrer" });
}

console.log("\n--- Rapport (aucune valeur de secret n'est affichée) ---");
for (const line of report) {
  console.log(
    `  ${line.name} [${line.id}]  annonces=${line.listings}  credentials_distincts=${line.distinct}  -> ${line.action}`
  );
}

// ── 4. Conflit : ARRÊT IMMÉDIAT, rien n'est écrit ─────────────────────────
if (conflicts.length > 0) {
  console.error("\n=========================================================");
  console.error("STOP — CREDENTIAL_CONFLICT");
  console.error("=========================================================");
  for (const conflict of conflicts) {
    console.error(
      `  ${conflict.name} [${conflict.id}] : ${conflict.distinct} credentials DIFFERENTS pour ${conflict.listings} annonces.`
    );
  }
  console.error(
    "\nAucun credential n'a ete ecrit. Chaque etablissement doit avoir SON propre provider,\n" +
    "puis le backfill pourra etre relance sans ambiguite."
  );
  process.exit(2);
}

// ── 5. Écriture ────────────────────────────────────────────────────────────
if (toWrite.length === 0) {
  console.log("\nAucune écriture nécessaire.");
  process.exit(0);
}

if (DRY_RUN) {
  console.log(`\n--dry-run : ${toWrite.length} provider(s) seraient mis a jour.`);
  process.exit(0);
}

console.log("");
let written = 0;

for (const target of toWrite) {
  const { error } = await supabase
    .from("providers")
    .update({ outbound_api_key_encrypted: encryptCredential(target.credential) })
    .eq("id", target.id);

  if (error) {
    console.error(`  ECHEC ${target.name} [${target.id}] : ${error.message}`);
    process.exit(1);
  }
  written += 1;
  console.log(`  ${target.name} [${target.id}] : credential chiffre et enregistre.`);
}

console.log(`\nTerminé : ${written} provider(s) mis a jour.`);
console.log("Le fallback legacy reste actif jusqu'a la vérification du déploiement.");
