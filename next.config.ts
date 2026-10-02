import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Domaines autorisés à charger les ressources du serveur de dev.
  // Sans cela, les bundles JS renvoient 403 depuis l'aperçu et React
  // ne s'hydrate pas (page affichée mais non interactive).
  allowedDevOrigins: ["*.monkeycode-ai.live", "*.e2b.app"],
};

export default nextConfig;
