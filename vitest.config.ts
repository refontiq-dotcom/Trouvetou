import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Trouvetou — configuration Vitest.
 *
 * `jsdom` sert à rendre les composants React (bouton « Vue 360° », ouverture et
 * fermeture de la visionneuse). Les tests de parsing restent en `node`, plus
 * rapides : ils ne touchent pas au DOM.
 *
 * L'alias `@/` est aligné sur `tsconfig.json` pour que les modules testés
 * s'importent comme dans le reste du code.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
