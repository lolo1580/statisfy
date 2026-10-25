"use client";

import { ErrorPanel } from "@/components/error-panel";

/** Erreurs de rendu sous la racine (connexion, inscription, partage…). */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel error={error} retry={retry} />;
}
