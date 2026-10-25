"use client";

import { useEffect } from "react";

/**
 * Dernier recours : erreur dans le layout racine lui-même. Ce fichier remplace
 * le layout, donc il doit fournir `<html>`/`<body>` et ses propres styles
 * (Tailwind/global.css ne sont pas chargés). Texte volontairement bilingue :
 * le contexte i18n n'est pas disponible ici.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <title>Statisfy — Erreur</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          colorScheme: "light dark",
          background: "Canvas",
          color: "CanvasText",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p style={{ fontSize: "2rem", margin: 0 }} aria-hidden>
            ⚠️
          </p>
          <h1 style={{ fontSize: "1.5rem", margin: "1rem 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, opacity: 0.75, fontSize: "0.875rem" }}>
            Une erreur est survenue. Rechargez la page ou réessayez.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "0.5rem 0 0",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, monospace",
                opacity: 0.6,
              }}
            >
              {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid currentColor",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Try again · Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
