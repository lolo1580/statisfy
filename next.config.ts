import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dashboard fortement dynamique (base de données + cookies) : on reste sur
  // le modèle de cache classique plutôt que Cache Components.
  cacheComponents: false,
  experimental: {
    // Les imports d'historique Spotify peuvent être volumineux.
    serverActions: {
      bodySizeLimit: "128mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // En-têtes de sécurité de base. Le CSP est volontairement omis : Next injecte
  // des scripts inline (hydratation) qu'il faudrait noncer, ce qui est fragile.
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    // CSP en production uniquement (le mode dev de Next utilise `eval`).
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
    ].join("; ");
    const headers =
      process.env.NODE_ENV === "production"
        ? [...base, { key: "Content-Security-Policy", value: csp }]
        : base;
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
