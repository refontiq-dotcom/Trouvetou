import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

// ============================================================================
// TROUVETOU — Chiffrement des credentials SORTANTS
//
// PROBLÈME RÉSOLU
//
// TrouveTout doit envoyer `x-api-key` au provider métier. Cela suppose de
// pouvoir RÉCUPÉRER le secret d'origine — un hash ne suffit pas, par
// construction. La clé entrante (`providers.api_key_hash`) est donc, par
// nature, incapable de jouer ce rôle.
//
// C'est pourquoi le credential sortant est un second champ, chiffré, et non une
// réutilisation de `api_key_hash`. Les deux sens du flux sont distincts :
//
//   entrant : provider ──x-api-key──▶ TrouveTout → stocké en HMAC (hash)
//   sortant : TrouveTout ──x-api-key──▶ provider  → stocké chiffré
//
// ALGORITHME : AES-256-GCM via `node:crypto`
//
//   - déjà disponible, donc AUCUNE dépendance ajoutée ;
//   - GCM est AUTHENTIFIÉ : toute altération du ciphertext est détectée, là où
//     AES-CBC laisserait passer une corruption qui déchiffrerait en octets
//     arbitraires ;
//   - implémenté nativement, donc rien à auditer côté supply chain.
//
// FORMAT : `v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`
//
// La version est explicite pour permettre une évolution : le déchiffrement
// refuse une version inconnue au lieu de l'interpréter. Hexadécimal pour éviter
// tout caractère ambigu (`+`, `/`, `=`) dans une valeur stockée en TEXT.
//
// SÉCURITÉ
//
// La clé vit dans l'environnement serveur
// (`TROUVETOU_CREDENTIAL_ENCRYPTION_KEY`) et n'est JAMAIS stockée en base.
// Sans elle, le déchiffrement échoue explicitement : mieux vaut un refus net
// qu'un repli silencieux qui enverrait une chaîne vide en `x-api-key`.
//
// Les messages d'erreur ne contiennent NI le secret NI le ciphertext : ils
// décrivent la NATURE de la panne, ce qui permet de diagnostiquer sans rien
// exposer de réutilisable.
// ============================================================================

/** Version du format de ciphertext. */
const CIPHERTEXT_VERSION = "v1";

/** Longueur de la clé en octets (AES-256). */
const KEY_LENGTH = 32;

/** Taille de l'IV (GCM recommande 96 bits). */
const IV_LENGTH = 12;

/** Longueur du tag d'authentification GCM. */
const AUTH_TAG_LENGTH = 16;

const ALGORITHM = "aes-256-gcm";

/**
 * Erreur de chiffrement ou de déchiffrement.
 *
 * Le message décrit la panne sans divulguer ni le secret ni le ciphertext : un
 * message d'erreur est journalisé et peut atteindre l'observabilité.
 */
export class CredentialEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialEncryptionError";
  }
}

/**
 * Clé de chiffrement depuis l'environnement serveur.
 *
 * Formats acceptés : 64 caractères hexadécimaux, ou 64 octets en base64. Le
 * hexadécimal est préféré pour sa lisibilité (aucun caractère à échapper dans
 * une variable d'environnement).
 */
function readEncryptionKey(): Buffer {
  const raw = process.env.TROUVETOU_CREDENTIAL_ENCRYPTION_KEY;

  if (raw === undefined || raw.trim() === "") {
    throw new CredentialEncryptionError(
      "TROUVETOU_CREDENTIAL_ENCRYPTION_KEY absente : les credentials sortants ne peuvent pas être déchiffrés."
    );
  }

  const value = raw.trim();

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  if (/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === KEY_LENGTH) return decoded;
  }

  // Le message ne reproduit PAS la clé : il indique seulement la forme attendue.
  throw new CredentialEncryptionError(
    "TROUVETOU_CREDENTIAL_ENCRYPTION_KEY invalide : 64 caractères hexadécimaux, ou 64 octets en base64."
  );
}

/**
 * Chiffre un credential sortant.
 *
 * @param plaintext Secret du provider, en clair. Jamais journalisé.
 * @returns `v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 * @throws {CredentialEncryptionError} Si la clé serveur est absente ou invalide.
 */
export function encryptCredential(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext === "") {
    throw new CredentialEncryptionError("Credential à chiffrer vide.");
  }

  const key = readEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    CIPHERTEXT_VERSION,
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Déchiffre un credential sortant.
 *
 * @param payload Valeur stockée en base, au format `v1:...`.
 * @returns Le secret d'origine.
 * @throws {CredentialEncryptionError} Si le format, la version, le tag
 *         d'authentification ou la clé est invalide.
 */
export function decryptCredential(payload: string): string {
  if (typeof payload !== "string" || payload === "") {
    throw new CredentialEncryptionError("Credential chiffré absent.");
  }

  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new CredentialEncryptionError("Format de credential chiffré invalide.");
  }

  const [version, ivHex, tagHex, dataHex] = parts;

  // Une version inconnue est refusée : mieux vaut un échec explicite qu'un
  // déchiffrement d'un format qu'on ne connaît pas.
  if (version !== CIPHERTEXT_VERSION) {
    throw new CredentialEncryptionError(
      `Version de format de credential non prise en charge : ${version}.`
    );
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(dataHex, "hex");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new CredentialEncryptionError("Credential chiffré tronqué ou corrompu.");
  }

  let plaintext: string;
  try {
    const key = readEncryptionKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    // setAuthTag AVANT update : c'est ce qui déclenche la vérification GCM.
    decipher.setAuthTag(authTag);
    plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch (error: unknown) {
    // AES-GCM lève si le tag est invalide : c'est exactement la protection
    // recherchée contre l'altération du ciphertext en base.
    if (error instanceof CredentialEncryptionError) throw error;
    throw new CredentialEncryptionError(
      "Déchiffrement du credential impossible : clé absente ou données altérées."
    );
  }

  return plaintext;
}

/**
 * Teste si une valeur ressemble à un credential chiffré de notre format.
 *
 * Permet de distinguer un ciphertext d'un secret en clair resté en base, sans
 * jamais tenter de le déchiffrer.
 */
export function isEncryptedCredential(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  return parts.length === 4 && parts[0] === CIPHERTEXT_VERSION;
}

/**
 * Comparaison à temps constant de deux credentials en clair.
 *
 * Utilisée par le backfill pour détecter un conflit sans le divulguer : deux
 * clés différentes ne sont jamais égales, mais leur comparaison ne doit pas
 * révéler par sa durée laquelle des deux correspond.
 */
export function secretsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
