/**
 * Restaure une sauvegarde PostgreSQL (`.dump`) dans la base cible.
 *
 *   pnpm db:restore chemin/vers/statisfy-<horodatage>.dump
 *
 * Un dump de sécurité de l'état actuel est créé avant d'écraser.
 * Nécessite `pg_restore` (paquet `postgresql-client`).
 */
import "dotenv/config";
import fs from "node:fs";
import { restoreDatabase, runBackup } from "../src/lib/backup";

async function main() {
  const file = process.argv[2];
  if (!file) {
    throw new Error("Usage : pnpm db:restore <fichier.dump>");
  }
  if (!fs.existsSync(file)) {
    throw new Error(`Fichier introuvable : ${file}`);
  }

  console.log("→ Sauvegarde de l'état actuel…");
  const backup = await runBackup().catch(() => null);
  if (backup) console.log(`  ${backup.file} → ${backup.directory}`);

  console.log(`→ Restauration de ${file}…`);
  await restoreDatabase(file);
  console.log("Terminé.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
