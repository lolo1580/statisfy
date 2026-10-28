# Contribuer à Statisfy

Merci pour votre intérêt ! Ce guide résume les conventions du projet.

## Mise en route

```bash
pnpm install
cp .env.example .env      # renseignez SESSION_SECRET, CREDENTIALS_KEY, DATABASE_URL
docker compose up -d db
pnpm db:migrate
pnpm dev
```

Prérequis : Node.js 22+, pnpm 12+ et PostgreSQL 18.

## Avant d'ouvrir une pull request

```bash
pnpm format        # applique Prettier
pnpm lint          # ESLint (config Next.js + Prettier)
pnpm test          # tests unitaires (Vitest)
pnpm build         # vérifie le build de production
```

La CI exécute aussi `pnpm format:check`, `pnpm test:coverage` (avec des seuils
minimaux) et les tests e2e Playwright (`pnpm test:e2e`). Une PR qui échoue sur
ces étapes ne sera pas fusionnée.

## Conventions

- **Langue** : commentaires et libellés d'interface en français, code et
  identifiants en anglais. Toute chaîne visible doit passer par `src/i18n`
  (clés présentes à la fois dans `en.ts` et `fr.ts` — un test le vérifie).
- **Formatage** : Prettier (`.prettierrc.json`). Évitez les changements de
  style non liés dans une PR fonctionnelle.
- **Style** : restez proche du code existant (composants serveur par défaut,
  `"use client"` uniquement si nécessaire, validation Zod côté serveur).
- **Accès aux données** : passez par `src/lib/stats.ts` pour les agrégations et
  par `src/lib/auth/dal.ts` pour l'utilisateur courant. Ne dupliquez pas les
  contrôles de rôle.
- **Sécurité** : ne journalisez jamais de secret, de jeton ou de mot de passe ;
  utilisez `logEvent` et `takeToken` pour l'observabilité et la limitation de
  débit.
- **Migrations** : toute évolution de `prisma/schema.prisma` doit être
  accompagnée d'une migration (`pnpm db:migrate:dev`). Les index trigrammes
  vivent dans `prisma/indexes.sql`.

## Tests

- Un correctif de logique métier dans `src/lib` doit venir avec un test dans
  `test/`.
- Les parcours utilisateurs critiques (connexion, partage, API publique) sont
  couverts par `e2e/`.
- Les bases de test sont dédiées (`statisfy_e2e`) et recréées automatiquement.

## Commits

Les messages suivent le style `type(scope): résumé` (ex.
`fix(rate-limit): évite un seau partagé sans IP`). Un commit = un changement
cohérent, avec une explication du *pourquoi* dans le corps si nécessaire.
