/**
 * TROUVETOU — Transport email (Resend, API REST).
 *
 * Pas de SDK : un POST `fetch` suffit, garde le bundle serveur léger et évite
 * une dépendance à maintenir. La clé ne quitte jamais le serveur.
 *
 * Variables requises :
 *   RESEND_API_KEY    clé API (dashboard Resend → API Keys)
 *   ALERTS_FROM_EMAIL expéditeur vérifié, ex. "Trouvetou <alertes@trouvetou.app>"
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Vrai si le transport est configuré sur ce déploiement. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERTS_FROM_EMAIL);
}

/**
 * Envoie un email transactionnel.
 *
 * Ne lève jamais : toute erreur (réseau, quota, domaine non vérifié) revient
 * sous forme de résultat, à charge de l'appelant de la journaliser et de
 * décider quoi afficher. Un échec d'envoi ne doit pas faire perdre l'abonnement.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Configuration email incomplète (RESEND_API_KEY / ALERTS_FROM_EMAIL).",
    };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!response.ok || !payload.id) {
      return {
        ok: false,
        error: payload.message ?? payload.name ?? `HTTP ${response.status}`,
      };
    }

    return { ok: true, id: payload.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erreur réseau",
    };
  }
}
