// ============================================================================
// TROUVETOU ↔ SCHOOLY — Client HTTP serveur
//
// Consomme les routes partenaires `/api/trouvetou/*` de Schooly. Le Bearer
// n'est JAMAIS envoyé au navigateur : toutes les pages Trouvetou passent par
// les routes internes `/api/ecoles/*` (route handlers serveur) qui délèguent
// à ce client.
//
// Configuration requise (côté serveur Trouvetou) :
//   - SCHOOLY_API_URL          : URL de base Schooly (ex. https://schooly...)
//   - TROUVETOU_API_KEY_PEPPER : clé partagée avec Schooly
//                                (fallback accepté : TROUVETOU_API_KEY)
//
// Aucune dépendance externe : `fetch` natif Node ≥ 18.
// ============================================================================

import {
  SchoolyApiError,
  SchoolyConfigError,
  type SchoolyCatalog,
  type SchoolyConfirmPaymentPayload,
  type SchoolyCreateReservationPayload,
  type SchoolyReservation,
} from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

/** Options internes de bas niveau. */
interface RequestOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  signal?: AbortSignal;
}

/** Récupère la configuration. Lève `SchoolyConfigError` si elle est incomplète. */
export function getSchoolyConfig(): {
  baseUrl: string;
  apiKey: string;
} {
  const baseUrl = process.env.SCHOOLY_API_URL?.trim().replace(/\/+$/, "");
  const apiKey =
    process.env.TROUVETOU_API_KEY_PEPPER?.trim() ||
    process.env.TROUVETOU_API_KEY?.trim();

  if (!baseUrl) {
    throw new SchoolyConfigError(
      "SCHOOLY_API_URL n'est pas configuré côté serveur Trouvetou."
    );
  }
  if (!apiKey) {
    throw new SchoolyConfigError(
      "TROUVETOU_API_KEY_PEPPER (ou TROUVETOU_API_KEY) n'est pas configuré."
    );
  }

  return { baseUrl, apiKey };
}

/**
 * Indique si l'intégration Schooly est utilisable sans lever d'exception.
 * À utiliser dans les pages pour basculer sur le catalogue générique si la
 * configuration manque (ex. en dev local sans Schooly).
 */
export function isSchoolyConfigured(): boolean {
  try {
    getSchoolyConfig();
    return true;
  } catch {
    return false;
  }
}

async function request<T>({ method, path, body, signal }: RequestOptions): Promise<T> {
  const { baseUrl, apiKey } = getSchoolyConfig();

  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const composedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const init: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    signal: composedSignal,
    cache: "no-store",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, init);
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new SchoolyApiError("Délai d'attente dépassé vers Schooly", 504, "TIMEOUT");
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new SchoolyApiError("Requête annulée", 499, "ABORTED");
    }
    throw new SchoolyApiError(
      `Impossible de joindre Schooly : ${err instanceof Error ? err.message : "erreur inconnue"}`,
      502,
      "NETWORK"
    );
  }

  const text = await res.text();
  const json = text.length > 0 ? safeParseJson(text) : null;

  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : null) ?? `Erreur Schooly ${res.status}`;
    throw new SchoolyApiError(message, res.status);
  }

  return json as T;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Récupère le catalogue public des écoles publiées.
 * `GET /api/trouvetou`
 */
export async function fetchSchoolyCatalog(
  signal?: AbortSignal
): Promise<SchoolyCatalog> {
  return request<SchoolyCatalog>({ method: "GET", path: "/api/trouvetou", signal });
}

/**
 * Crée un dossier de réservation `pending_payment`.
 * `POST /api/trouvetou`
 */
export async function createSchoolyReservation(
  payload: SchoolyCreateReservationPayload,
  signal?: AbortSignal
): Promise<SchoolyReservation> {
  const data = await request<{ reservation: SchoolyReservation } | SchoolyReservation>({
    method: "POST",
    path: "/api/trouvetou",
    body: payload,
    signal,
  });
  return extractReservation(data);
}

/**
 * Confirme le paiement d'une réservation.
 * `POST /api/trouvetou/reservations/:id/payment`
 */
export async function confirmSchoolyReservationPayment(
  reservationId: string,
  payload: SchoolyConfirmPaymentPayload,
  signal?: AbortSignal
): Promise<SchoolyReservation> {
  if (!reservationId || typeof reservationId !== "string") {
    throw new SchoolyApiError("Identifiant de réservation invalide", 400, "INVALID_ID");
  }
  const data = await request<{ reservation: SchoolyReservation } | SchoolyReservation>({
    method: "POST",
    path: `/api/trouvetou/reservations/${encodeURIComponent(reservationId)}/payment`,
    body: payload,
    signal,
  });
  return extractReservation(data);
}

function extractReservation(
  data: { reservation: SchoolyReservation } | SchoolyReservation
): SchoolyReservation {
  if (data && typeof data === "object" && "reservation" in data && data.reservation) {
    return data.reservation;
  }
  return data as SchoolyReservation;
}
