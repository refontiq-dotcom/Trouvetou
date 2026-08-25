import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Format d'une clé API Trouvetou :
 *   tv_live_<providerId>.<secret>
 *
 * Le préfixe porte l'identifiant du provider (résolution O(1)) et le secret
 * est une valeur aléatoire de 32 octets (base64url). Seule l'empreinte
 * HMAC-SHA256(clé complète, pepper) est stockée en base (`providers.api_key_hash`).
 */

const KEY_PREFIX = "tv_live_";

/** Génère une nouvelle clé API brute (affichée UNE seule fois à l'opérateur). */
export function generateApiKey(providerId: string): string {
  const secret = randomBytes(32).toString("base64url");
  return `${KEY_PREFIX}${providerId}.${secret}`;
}

/** Extrait le providerId depuis une clé API brute, ou `null` si le format est invalide. */
export function parseProviderIdFromKey(apiKey: string): string | null {
  const match = /^tv_live_([0-9a-fA-F-]{36})\./.exec(apiKey);
  return match ? match[1] : null;
}

/** Empreinte HMAC-SHA256 d'une clé API brute. */
export function hashApiKey(apiKey: string): string {
  const pepper = process.env.TROUVETOU_API_KEY_PEPPER ?? "";
  return createHmac("sha256", pepper).update(apiKey, "utf8").digest("hex");
}

/** Comparaison constante en temps de deux empreintes hexadécimales. */
export function secureCompare(knownHash: string, candidateHash: string): boolean {
  const a = Buffer.from(knownHash, "hex");
  const b = Buffer.from(candidateHash, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
