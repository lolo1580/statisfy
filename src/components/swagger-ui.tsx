"use client";

import { useRef, useState } from "react";
import Script from "next/script";
import "swagger-ui-dist/swagger-ui.css";
import { useI18n } from "@/components/i18n-provider";

/**
 * Rendu de Swagger UI à partir de la spécification OpenAPI servie par
 * `/api/docs/openapi.json`.
 *
 * Les fichiers de Swagger UI sont servis par l'instance elle-même
 * (`/api/docs/swagger-ui/...`), sans CDN : aucune connexion sortante n'est
 * nécessaire. `next/script` reçoit automatiquement le nonce CSP de la requête.
 */

type SwaggerUIBundle = (config: Record<string, unknown>) => void;

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIBundle;
  }
}

export function SwaggerUi({ specUrl }: { specUrl: string }) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Swagger UI est monté impérativement : React ne doit pas rendre son DOM.
  const mount = () => {
    const node = container.current;
    if (!node || !window.SwaggerUIBundle) return;
    // Garde contre le double effet de StrictMode en développement.
    if (node.dataset.initialized === "true") return;
    node.dataset.initialized = "true";
    window.SwaggerUIBundle({
      url: specUrl,
      domNode: node,
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      persistAuthorization: true,
      docExpansion: "list",
      defaultModelsExpandDepth: 1,
    });
  };

  return (
    <div>
      <Script
        src="/api/docs/swagger-ui/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => {
          setReady(true);
          mount();
        }}
        onError={() => setFailed(true)}
      />
      {!ready && !failed ? (
        <p className="rounded-2xl border border-border bg-surface/70 p-5 text-sm text-muted">
          {t("apiDocs.loading")}
        </p>
      ) : null}
      {failed ? (
        <p className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm text-danger">
          {t("apiDocs.loadError")}{" "}
          <a className="underline" href={specUrl}>
            {specUrl}
          </a>
        </p>
      ) : null}
      <div
        ref={container}
        className="swagger-ui-host rounded-2xl border border-border bg-white p-2 sm:p-4"
      />
    </div>
  );
}
