# Security policy / Politique de sécurité

## Supported versions / Versions prises en charge

Only the latest release receives security fixes. If you self-host Statisfy,
upgrade to the most recent tag before reporting an issue.

Seule la dernière version reçoit des correctifs de sécurité. Si vous hébergez
Statisfy, mettez à jour vers le tag le plus récent avant de signaler un
problème.

## Reporting a vulnerability / Signaler une vulnérabilité

**Please do not open a public issue for security problems.**

Contact the maintainer privately, either through GitHub's *Report a
vulnerability* feature (Security tab → *Advisories*) or by email at the address
listed on the repository profile. Include:

- the affected version or commit,
- a description and, if possible, reproduction steps,
- the impact you expect (data leak, account takeover, denial of service…).

**Merci de ne pas ouvrir d'issue publique pour un problème de sécurité.**
Utilisez de préférence l'onglet *Security → Advisories* de GitHub, ou contactez
le mainteneur en privé. Précisez la version concernée, les étapes de
reproduction et l'impact estimé.

You can expect an acknowledgement within a few days. Once the fix is ready, a
coordinated disclosure and a release note will be published.

## Scope / Périmètre

In scope: authentication and sessions, authorization (per-user isolation,
admin area), Spotify OAuth, encrypted source credentials, public share links,
the stats API, file imports and backups.

Out of scope: vulnerabilities requiring an already-compromised host, issues in
third-party services (Spotify, OpenObserve, PostgreSQL), and social engineering.

## Good practices for operators / Bonnes pratiques pour les opérateurs

- Generate fresh secrets with `openssl rand -base64 32` (`SESSION_SECRET`,
  `CREDENTIALS_KEY`) and never reuse the examples from `.env.example`.
- Serve the instance over HTTPS and keep `TRUST_PROXY_HEADERS` consistent with
  your reverse proxy (otherwise rate limiting falls back to per-account keys).
- Close public registrations (`ALLOW_REGISTRATION=false`) on private instances.
- Keep automatic backups enabled and test a restore from time to time.
