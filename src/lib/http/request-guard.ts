// ============================================================================
// TROUVETOU — Gardes de sécurité pour endpoints publics
// Deux protections indépendantes, utilisées par /api/catalog/bookings :
//
//   1. verifySameOrigin()   → bloque CSRF / abus depuis un site tiers.
//   2. createRateLimiter()  → borne le débit (spam de réservations, DoS PMS).
//
// Sans dépendance externe (pas de SDK de rate-limiting à installer) et
// testable isolément.
// ============================================================================

/** Fenêtre glissante par défaut du rate limiter. */
const DEFAULT_WINDOW_MS = 60_000;

/** Nettoyage des entrées expirées, au plus une fois par fenêtre. */
let lastSweepAt = 0;

/** Origines autorisées, calculées une seule fois par processus. */
let allowedOriginsCache: Set<string> | null = null;

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Origines acceptant une requête navigateur.
 *
 * - `NEXT_PUBLIC_SITE_URL` : le domaine public de production.
 * - `BOOKING_ALLOWED_ORIGINS` : liste séparée par des virgules (previews
 *   Vercel, staging, éventuellement un alias de domaine).
 * - En développement : localhost et loopback, sinon aucun formulaire local ne
 *   fonctionnerait une fois le contrôle actif.
 */
export function getAllowedOrigins(): Set<string> {
  if (allowedOriginsCache) return allowedOriginsCache;

  const origins = new Set<string>();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) origins.add(normalizeOrigin(siteUrl));

  const extra = process.env.BOOKING_ALLOWED_ORIGINS;
  if (extra) {
    for (const candidate of extra.split(",")) {
      const normalized = normalizeOrigin(candidate);
      if (normalized) origins.add(normalized);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  allowedOriginsCache = origins;
  return origins;
}

/** Reset du cache d'origines (tests / changement d'env en cours de route). */
export function resetAllowedOriginsCache(): void {
  allowedOriginsCache = null;
}

export type OriginVerdict =
  | { ok: true }
  | { ok: false; reason: "origin_missing" | "origin_forbidden"; detail: string };

/**
 * Vérifie que la requête provient bien du site (et non d'un formulaire tiers).
 *
 * `Origin` est envoyé par les navigateurs sur toutes les requêtes POST. En
 * repli on lit `Referer`. Si les deux sont absents, la requête est refusée :
 * cet endpoint n'a aucune vocation à être appelé hors navigateur.
 */
export function verifySameOrigin(headers: Headers): OriginVerdict {
  const allowed = getAllowedOrigins();

  // Configuration absente : on refuse plutôt que de laisser passer une
  // requête non vérifiable (fail-closed).
  if (allowed.size === 0) {
    return {
      ok: false,
      reason: "origin_forbidden",
      detail: "Aucune origine autorisée n'est configurée (NEXT_PUBLIC_SITE_URL).",
    };
  }

  const origin = headers.get("origin");
  if (origin) {
    return allowed.has(normalizeOrigin(origin))
      ? { ok: true }
      : { ok: false, reason: "origin_forbidden", detail: "Origine non autorisée." };
  }

  const referer = headers.get("referer");
  if (!referer) {
    return { ok: false, reason: "origin_missing", detail: "En-tête Origin ou Referer absent." };
  }

  let refererOrigin: string;
  try {
    refererOrigin = new URL(referer).origin;
  } catch {
    return { ok: false, reason: "origin_forbidden", detail: "Referer illisible." };
  }

  return allowed.has(normalizeOrigin(refererOrigin))
    ? { ok: true }
    : { ok: false, reason: "origin_forbidden", detail: "Origine non autorisée." };
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** Secondes avant expiration de la fenêtre, pour l'en-tête Retry-After. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  (key: string, limit?: number, windowMs?: number): RateLimitDecision;
}

/**
 * Limiteur de débit en mémoire (fenêtre glissante simplifiée).
 *
 * Portée : ce processus uniquement. Sur Vercel chaque instance a sa mémoire,
 * donc cette garde est un premier filtre — le plafond dur et distribué doit
 * venir de Vercel Firewall / WAF.
 */
export function createRateLimiter(): RateLimiter {
  const hits = new Map<string, number[]>();

  return function rateLimit(key, limit = 5, windowMs = DEFAULT_WINDOW_MS) {
    const now = Date.now();

    if (now - lastSweepAt > windowMs) {
      lastSweepAt = now;
      for (const [entryKey, timestamps] of hits) {
        const kept = timestamps.filter((t) => now - t < windowMs);
        if (kept.length === 0) hits.delete(entryKey);
        else hits.set(entryKey, kept);
      }
    }

    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      };
    }

    recent.push(now);
    hits.set(key, recent);

    return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
  };
}

/** Limiteur partagé par le module (une seule instance par processus). */
export const bookingsRateLimiter = createRateLimiter();

/** Adresse client pour le débit : 1re valeur de X-Forwarded-For (gérée par Vercel). */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/** Comparaison en temps constant de deux secrets courts. */
export function safeSecretEqual(expected: string, candidate: string): boolean {
  if (!expected || !candidate || expected.length !== candidate.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}
