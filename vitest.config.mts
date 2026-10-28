import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuration Vitest.
 *
 * - `@/*` reprend l'alias de `tsconfig.json`.
 * - `server-only` est remplacé par un module vide : les libs serveur (crypto,
 *   password…) sont importables en environnement Node sans contexte Next.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // Le cœur métier est dans `src/lib` ; les fichiers purement
      // infrastructure (connexion DB, client généré) sont exclus.
      include: ["src/lib/**/*.ts", "src/i18n/**/*.ts"],
      exclude: ["src/lib/db.ts", "src/generated/**"],
      // Planchers volontairement alignés sur la couverture actuelle : ils
      // n'imposent pas de rattraper le retard d'un coup, mais empêchent toute
      // régression silencieuse. À relever au fur et à mesure des ajouts.
      thresholds: {
        lines: 30,
        statements: 30,
        functions: 35,
        branches: 30,
      },
    },
  },
});
