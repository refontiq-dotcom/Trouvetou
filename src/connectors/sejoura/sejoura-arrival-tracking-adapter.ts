import type {
  ArrivalTrackingAdapter,
  TrackingProviderContext,
  TrackingRequest,
  TrackingResult,
} from "@/lib/arrival-tracking/contract";
import { SEJOURA_PROVIDER_TYPE } from "./sejoura-booking-adapter";

/**
 * TROUVETOU — Connecteur Séjour@ pour le suivi d'arrivée
 *
 * Seul endroit du dépôt qui connaît :
 *   - l'endpoint `/api/v1/external/arrival-tracking` ;
 *   - le champ discriminant `action` de la charge utile ;
 *   - le nom des champs `booking_id`, `public_token`, `latitude`… ;
 *   - l'URL de base de l'API Séjour@.
 *
 * PASSE-THROUGH STRICT
 *
 * La réponse du fournisseur est renvoyée telle quelle, avec son statut HTTP
 * d'origine. Le suivi d'arrivée a toujours fonctionné ainsi et le navigateur
 * en dépend : normaliser cette charge utile casserait des intégrations
 * vivantes. C'est aussi pourquoi le contrat expose `status` + `body: unknown`
 * plutôt qu'un type métier : le core ignore volontairement ce qu'il transporte.
 *
 * SÉCURITÉ
 *
 * La clé d'API provient du CONTEXTE, jamais de la requête du client. L'URL de
 * base vient de la configuration serveur : le client ne peut ni la choisir, ni
 * influencer la destination. Aucun secret n'est journalisé ni renvoyé.
 */

// ── Utilitaires de lecture défensive ────────────────────────────────────────

/** Corps JSON renvoyé, ou `{}` si la réponse n'est pas du JSON. */
async function readJsonSafely(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // Une réponse non JSON (page d'erreur, coupure réseau) ne doit pas faire
    // échouer l'appel : le statut reste porteur d'information, et le frontend
    // reçoit `{}` comme auparavant.
    return {};
  }
}

// ── Transport injectable (tests sans réseau) ───────────────────────────────

export type TrackingTransport = (
  input: string,
  init: { method: string; headers: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface SejouraTrackingOptions {
  /** URL de base de l'API Séjour@. Jamais fournie par le client. */
  baseUrl: string;
  /** Transport HTTP injectable. Par défaut `fetch`. */
  transport?: TrackingTransport;
}

const defaultTrackingTransport: TrackingTransport = async (input, init) => {
  const response = await fetch(input, { ...init, cache: "no-store" } as RequestInit);
  return { ok: response.ok, status: response.status, json: () => response.json() };
};

export class SejouraArrivalTrackingAdapter implements ArrivalTrackingAdapter {
  readonly providerType = SEJOURA_PROVIDER_TYPE;

  private readonly baseUrl: string;
  private readonly transport: TrackingTransport;

  constructor(options: SejouraTrackingOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.transport = options.transport ?? defaultTrackingTransport;
  }

  start(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult> {
    return this.call("start", request, context);
  }

  update(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult> {
    return this.call("update", request, context);
  }

  stop(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult> {
    return this.call("stop", request, context);
  }

  status(request: TrackingRequest, context: TrackingProviderContext): Promise<TrackingResult> {
    return this.call("status", request, context);
  }

  /**
   * Appel unique pour les quatre verbes.
   *
   * Séjour@ expose un point d'entrée unique dispatcher par le champ `action` :
   * factoriser ici garantit que les quatre opérations ne peuvent pas diverger
   * sur la forme du payload.
   */
  private async call(
    action: "start" | "update" | "stop" | "status",
    request: TrackingRequest,
    context: TrackingProviderContext
  ): Promise<TrackingResult> {
    const payload: Record<string, unknown> = {
      action,
      booking_id: request.bookingId,
    };

    // `public_token` n'est envoyé que s'il existe : l'exiger à chaque appel
    // changerait le contrat d'origine.
    if (request.publicToken) payload.public_token = request.publicToken;

    if (action === "update") {
      const position = request.position;
      payload.latitude = Number(position?.latitude);
      payload.longitude = Number(position?.longitude);
      if (position?.accuracy != null) payload.accuracy = Number(position.accuracy);
    }

    const response = await this.transport(
      `${this.baseUrl}/api/v1/external/arrival-tracking`,
      {
        method: "POST",
        // La clé d'API vient du contexte serveur. Elle n'est ni journalisée,
        // ni renvoyée : le navigateur ne reçoit que le jeton de session.
        headers: {
          "Content-Type": "application/json",
          "x-api-key": context.credentials.apiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    return { status: response.status, body: await readJsonSafely(response) };
  }
}
