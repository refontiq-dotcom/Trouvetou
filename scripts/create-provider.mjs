#!/usr/bin/env node
/**
 * TROUVETOU — Enregistrement d'un provider (source d'alimentation)
 *
 * Génère une clé API unique, en stocke uniquement l'empreinte HMAC-SHA256
 * (avec pepper) dans `providers.api_key_hash`, et affiche la clé UNE seule
 * fois à l'écran. Transmettez cette clé au logiciel partenaire (Séjoura, PMS,
 * SIS, ...) qui l'utilisera pour POST /api/v1/sync.
 *
 * Prérequis (.env.local ou variables d'environnement) :
 *   TROUVETOU_SUPABASE_URL=...
 *   TROUVETOU_SUPABASE_SERVICE_ROLE_KEY=...
 *   TROUVETOU_API_KEY_PEPPER=<au moins 32 caractères aléatoires>
 *
 * Usage :
 *   node scripts/create-provider.mjs "Séjoura" hotel --webhook https://sejoura.app/sync-callback
 */
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Fichier absent : les variables viendront de l'environnement du shell.
  }
}

const [name, categorySlug] = process.argv.slice(2);
const webhookFlag = process.argv.indexOf("--webhook");
const webhookUrl =
  webhookFlag >= 0 && process.argv[webhookFlag + 1]
    ? process.argv[webhookFlag + 1]
    : null;

if (!name || !categorySlug) {
  console.error(
    "Usage: node scripts/create-provider.mjs \"<nom>\" <slug-categorie> [--webhook <url>]"
  );
  console.error(
    "Exemple: node scripts/create-provider.mjs \"Séjoura\" hotel --webhook https://sejoura.app/sync-callback"
  );
  process.exit(1);
}

const url = process.env.TROUVETOU_SUPABASE_URL;
const serviceRole = process.env.TROUVETOU_SUPABASE_SERVICE_ROLE_KEY;
const pepper = process.env.TROUVETOU_API_KEY_PEPPER;

if (!url || !serviceRole) {
  console.error(
    "Variables manquantes: TROUVETOU_SUPABASE_URL et TROUVETOU_SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}
if (!pepper || pepper.length < 32) {
  console.error(
    "Variable TROUVETOU_API_KEY_PEPPER requise (au moins 32 caractères aléatoires)."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1. Catégorie
const { data: category, error: categoryError } = await supabase
  .from("categories")
  .select("id")
  .eq("slug", categorySlug)
  .maybeSingle();

if (categoryError) {
  console.error("Erreur lors de la lecture de la catégorie :", categoryError.message);
  process.exit(1);
}
if (!category) {
  console.error(
    `Catégorie inconnue: "${categorySlug}". Disponibles: hotel, residence, clinic, school, other.`
  );
  process.exit(1);
}

// 2. Génération de la clé API (id de provider + secret 32 octets)
const providerId = randomUUID();
const secret = randomBytes(32).toString("base64url");
const apiKey = `tv_live_${providerId}.${secret}`;

// 3. Empreinte HMAC-SHA256 de la clé complète
const apiKeyHash = createHmac("sha256", pepper).update(apiKey, "utf8").digest("hex");

// 4. Insertion du provider (id explicite, celui embarqué dans la clé)
const { error: insertError } = await supabase.from("providers").insert({
  id: providerId,
  name,
  category_id: category.id,
  api_key_hash: apiKeyHash,
  webhook_url: webhookUrl,
  is_active: true,
});

if (insertError) {
  console.error("Erreur lors de l'enregistrement du provider :", insertError.message);
  process.exit(1);
}

console.log("================================================================");
console.log("Provider enregistré avec succès.");
console.log("  ID        :", providerId);
console.log("  Nom       :", name);
console.log("  Catégorie :", categorySlug);
if (webhookUrl) console.log("  Webhook   :", webhookUrl);
console.log("----------------------------------------------------------------");
console.log("CLÉ API (transmettez-la au logiciel partenaire, une seule fois) :");
console.log("  " + apiKey);
console.log("----------------------------------------------------------------");
console.log("Seule l'empreinte HMAC est stockée en base. Une clé perdue est");
console.log("irrécupérable : supprimez puis recréez le provider.");
console.log("================================================================");
