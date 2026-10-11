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
  // En-têtes de sécurité de base. Le **CSP** est géré par `middleware.ts`
  // (nonce par requête), car il doit être posé sur la requête pour que Next
  // applique le nonce à ses scripts d'hydratation.
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
    return [{ source: "/(.*)", headers: base }];
  },
};

export default nextConfig;
