import type { MetadataRoute } from "next";
import { appName } from "@/lib/env";

/** Manifeste PWA (installable sur mobile/desktop, sans cache hors ligne). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName,
    description:
      "Self-hosted dashboard to explore your Spotify listening statistics.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0d1117",
    theme_color: "#0d1117",
    icons: [
      {
        src: "/api/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
