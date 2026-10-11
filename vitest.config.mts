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
  },
});
