import { formatFCFA } from "@/lib/utils";

/**
 * TROUVETOU — Modèles d'emails d'alerte.
 *
 * Le HTML ne compose que des valeurs déjà validées (catégorie issue d'une
 * liste fermée, ville bornée à 80 caractères) ET échappées ici : une ville
 * saisie librement ne doit jamais pouvoir injecter de balise.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://trouvetou.app").replace(/\/+$/, "");
}

/** « Toutes les catégories » / « Hôtels » */
function scopeLabel(categoryLabel: string | null, city: string | null): string {
  const parts: string[] = [];
  parts.push(categoryLabel ?? "Toutes les catégories");
  parts.push(city ? `Ville : ${city}` : "Toutes les villes");
  return parts.join(" · ");
}

function layout(body: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f6f8fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#0b0f14;padding:20px 28px;">
                <span style="color:#b5e04b;font-size:18px;font-weight:700;letter-spacing:-0.02em;">Trouvetou</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#1f2630;font-size:15px;line-height:1.6;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;color:#6b7280;font-size:12px;line-height:1.5;">
                Vous recevez cet email parce qu'une alerte a été créée sur Trouvetou.
                Pour ne plus être contacté, répondez simplement à ce message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function alertConfirmationEmail(input: {
  categoryLabel: string | null;
  city: string | null;
}): { subject: string; html: string; text: string } {
  const scope = scopeLabel(input.categoryLabel, input.city);
  const subject = "Votre alerte Trouvetou est activée";

  const html = layout(`
    <p style="margin:0 0 16px;font-size:17px;font-weight:700;">Votre alerte est activée ✅</p>
    <p style="margin:0 0 16px;">Nous avons bien enregistré votre abonnement :</p>
    <p style="margin:0 0 20px;padding:12px 16px;background:#f6f8fb;border-radius:10px;font-weight:600;">${escapeHtml(scope)}</p>
    <p style="margin:0 0 20px;">Vous recevrez un email dès qu'une nouvelle annonce correspondra à ces critères.</p>
    <p style="margin:0;">
      <a href="${escapeHtml(siteUrl())}" style="display:inline-block;background:#b5e04b;color:#0b0f14;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;">Explorer le catalogue</a>
    </p>
  `);

  const text = [
    "Votre alerte Trouvetou est activée.",
    "",
    scope,
    "",
    "Vous recevrez un email dès qu'une nouvelle annonce correspondra à ces critères.",
    "",
    siteUrl(),
  ].join("\n");

  return { subject, html, text };
}

export interface AlertListingItem {
  title: string;
  city: string | null;
  price: number | null;
  href: string;
}

export function newListingsEmail(input: {
  items: AlertListingItem[];
  categoryLabel: string | null;
  city: string | null;
}): { subject: string; html: string; text: string } {
  const count = input.items.length;
  const subject =
    count === 1
      ? "1 nouvelle annonce correspond à votre alerte"
      : `${count} nouvelles annonces correspondent à votre alerte`;

  const rows = input.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef1f5;">
          <a href="${escapeHtml(item.href)}" style="color:#0b0f14;font-weight:600;text-decoration:none;">${escapeHtml(item.title)}</a>
          <div style="color:#6b7280;font-size:13px;margin-top:2px;">
            ${escapeHtml(item.city ?? "Ville non précisée")}${
              item.price != null ? ` · ${escapeHtml(formatFCFA(item.price))}` : ""
            }
          </div>
        </td>
      </tr>`
    )
    .join("");

  const html = layout(`
    <p style="margin:0 0 8px;font-size:17px;font-weight:700;">${count === 1 ? "Une nouvelle annonce" : `${count} nouvelles annonces`}</p>
    <p style="margin:0 0 20px;color:#6b7280;">${escapeHtml(scopeLabel(input.categoryLabel, input.city))}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(siteUrl())}" style="display:inline-block;background:#b5e04b;color:#0b0f14;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;">Voir sur Trouvetou</a>
    </p>
  `);

  const text = [
    subject,
    "",
    scopeLabel(input.categoryLabel, input.city),
    "",
    ...input.items.map(
      (item) =>
        `- ${item.title}${item.city ? ` (${item.city})` : ""}${
          item.price != null ? ` — ${formatFCFA(item.price)}` : ""
        }\n  ${item.href}`
    ),
    "",
    siteUrl(),
  ].join("\n");

  return { subject, html, text };
}
