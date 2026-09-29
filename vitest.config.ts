import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Trouvetou — configuration Vitest.
 *
 * `jsdom` sert à rendre les composants React. Les modules purs (validation
 * d'URL, graphe de panoramas) n'ont pas besoin du DOM : ils tournent aussi
 * bien dedans, et l'unique coût est quelques millisecondes par fichier.
 *
 * L'alias `@/` est aligné sur `tsconfig.json` pour que les modules testés
 * s'importent exactement comme dans le reste du code — un test qui importerait
 * par un autre chemin que la production ne prouverait rien de l'intégration.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});