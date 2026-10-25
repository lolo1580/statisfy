import { execFileSync } from "node:child_process";

/**
 * Prépare la base des tests E2E : recrée une base vide puis applique les
 * migrations. Garde-fou : refuse toute base dont le nom ne finit pas par
 * `_e2e` (on ne veut jamais supprimer la base de développement/production).
 */

const rawUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("E2E_DATABASE_URL (ou DATABASE_URL) est requis.");
}

const url = new URL(rawUrl);
const database = url.pathname.replace(/^\//, "");
if (!/^[A-Za-z0-9_]+_e2e$/.test(database)) {
  throw new Error(
    `Refus de réinitialiser la base « ${database} » : le nom doit finir par _e2e.`,
  );
}

const adminUrl = new URL(rawUrl);
adminUrl.pathname = "/postgres";

const psql = (sql) =>
  execFileSync(
    "psql",
    [adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", sql],
    { stdio: "inherit", env: process.env },
  );

psql(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
psql(`CREATE DATABASE "${database}"`);

execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: rawUrl },
});
