import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Domaines autorisés à charger les ressources du serveur de dev.
  // Sans cela, les bundles JS renvoient 403 depuis l'aperçu et React
  // ne s'hydrate pas (page affichée mais non interactive).
  allowedDevOrigins: ["*.monkeycode-ai.live", "*.e2b.app"],

  poweredByHeader: false,

  /**
   * En-têtes de défense en profondeur.
   *
   * Pas de CSP ici : elle exige d'autoriser les scripts inline de Next et les
   * images distantes, et casserait l'application si elle était mal calibrée.
   * À introduire en `Content-Security-Policy-Report-Only` puis à durcir.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Géolocalisation et micro (recherche vocale) restent autorisés pour
          // l'application elle-même, rien d'autre.
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), microphone=(self), camera=(), payment=()",
          },
          // Pas de `includeSubDomains` ni de `preload` : ces deux options
          // engagent tout le domaine et ne se retirent pas rapidement. À
          // activer explicitement quand le domaine est entièrement maîtrisé.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
