/**
 * Génère une URL de partage WhatsApp avec un message pré-rempli.
 * Fonctionne sur mobile (ouvre l'app) et desktop (ouvre web.whatsapp.com).
 */
export function buildWhatsAppShareUrl(params: {
  name: string;
  city?: string | null;
  price?: number | null;
  priceSuffix?: string;
  url: string;
}): string {
  const parts = [`*${params.name}*`];
  if (params.city) parts.push(`📍 ${params.city}`);
  if (params.price != null) {
    parts.push(
      `💰 ${params.price.toLocaleString("fr-FR")} F CFA ${params.priceSuffix ?? ""}`
    );
  }
  parts.push("");
  parts.push(params.url);

  const text = encodeURIComponent(parts.join("\n"));
  return `https://wa.me/?text=${text}`;
}
