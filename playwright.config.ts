import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout (Playwright).
 *
 * Une base PostgreSQL **dédiée** est recréée à chaque exécution
 * (`statisfy_e2e`, voir `e2e/prepare-db.mjs`), puis les migrations sont
 * appliquées. Le serveur de développement est lancé automatiquement.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

function resolveE2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const main = process.env.DATABASE_URL;
  if (!main) {
    throw new Error(
      "DATABASE_URL (ou E2E_DATABASE_URL) est requis pour les tests E2E.",
    );
  }
  const url = new URL(main);
  url.pathname = "/statisfy_e2e";
  return url.toString();
}

const databaseUrl = resolveE2eDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // Mode production (comme en CI) : évite les aléas d'hydratation du serveur
    // de développement et valide aussi le CSP/nonce de production.
    command: `node e2e/prepare-db.mjs && pnpm build && pnpm start --port ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: "e2e-session-secret-e2e-session-secret-0123456789",
      CREDENTIALS_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      ALLOW_REGISTRATION: "true",
      APP_URL: baseURL,
    },
  },
});
