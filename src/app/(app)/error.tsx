"use client";

import { ErrorPanel } from "@/components/error-panel";

/**
 * Erreurs du shell applicatif : la navigation reste affichée (contrairement à
 * la frontière racine), ce qui permet de repartir vers une autre page.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel error={error} retry={retry} />;
}
