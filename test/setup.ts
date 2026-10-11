// Secrets factices pour les tests. `src/lib/env.ts` lit `process.env` au moment
// de l'appel, donc définir ces valeurs ici suffit.
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.CREDENTIALS_KEY ??= Buffer.alloc(32, 7).toString("base64");
