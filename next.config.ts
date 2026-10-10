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
};

export default nextConfig;
