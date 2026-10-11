import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy avec **nonce par requête**.
 *
 * (Next.js 16 nomme « Proxy » l'ancien « Middleware » ; même fonctionnalité.)
 *
 * Le nonce est posé à la fois sur la réponse et sur les en-têtes transmis à
 * Next ; Next lit alors le CSP de la requête et applique automatiquement ce
 * nonce à ses scripts d'hydratation (sinon il faudrait `'unsafe-inline'`).
 *
 * Le CSP est activé en **production** uniquement : en développement, Next
 * utilise `eval` et des scripts inline non noncés.
 */
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  // Le CSP doit figurer dans les en-têtes de *requête* pour que Next associe le
  // nonce à ses scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // On ignore les routes API et les fichiers statiques : ils n'ont pas
      // besoin de CSP, et on évite de recalculer un nonce pour rien.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
