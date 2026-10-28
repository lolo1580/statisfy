import { expect, test } from "@playwright/test";

/**
 * Vérifie les en-têtes de sécurité posés en production (le serveur E2E tourne
 * via `pnpm start`, donc le Proxy avec nonce est actif).
 */
test("CSP restreint les images aux CDN Spotify", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.status()).toBe(200);

  const csp = response.headers()["content-security-policy"];
  expect(csp).toBeTruthy();
  expect(csp).toContain(
    "img-src 'self' data: blob: https://*.scdn.co https://*.spotifycdn.com",
  );
  // Pas de joker HTTPS global pour les images.
  expect(csp).not.toContain("img-src 'self' data: blob: https:");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");

  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
});
