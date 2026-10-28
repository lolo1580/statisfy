import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // N'expose pas `X-Powered-By: Next.js`.
  poweredByHeader: false,
  // Sortie auto-portée : `.next/standalone` ne contient que le serveur et les
  // dépendances réellement utilisées (l'image Docker passe de ~1,5 Go à
  // quelques centaines de Mo). Démarré par `node server.js`.
  output: "standalone",
  // La page `/api-docs` charge Swagger UI depuis `node_modules` via une route
  // handler : la sortie autonome doit embarquer ces fichiers explicitement.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/swagger-ui-dist/**/*"],
  },
  // Dashboard fortement dynamique (base de données + cookies) : on reste sur
  // le modèle de cache classique plutôt que Cache Components.
  cacheComponents: false,
  experimental: {
    // Les imports d'historique Spotify peuvent être volumineux.
    serverActions: {
      bodySizeLimit: "128mb",
    },
    // Mise à niveau de sécurité Next.js suivie par l'agent (16.4.0 → 16.4.2).
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // En-têtes de sécurité de base. Le **CSP** est géré par `src/proxy.ts`
  // (nonce par requête), car il doit être posé sur la requête pour que Next
  // applique le nonce à ses scripts d'hydratation.
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      // À ne poser qu'en HTTPS : les navigateurs ignorent l'en-tête en clair.
      // Pas de `includeSubDomains` (l'instance peut cohabiter avec d'autres
      // services du même domaine).
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    return [{ source: "/(.*)", headers: base }];
  },
};

export default nextConfig;
