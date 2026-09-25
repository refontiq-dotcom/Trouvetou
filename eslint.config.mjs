import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees Kilo imbriqués dans le dépôt : leur code est déjà linté via sa
    // propre branche, les linter ici duplique chaque résultat.
    ".kilo/**",
  ]),
]);

export default eslintConfig;
