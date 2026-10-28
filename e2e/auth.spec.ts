import { expect, test } from "@playwright/test";

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("is redirected to the login page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test("Swagger documentation is served locally", async ({ page, request }) => {
  await page.goto("/api-docs");
  await expect(
    page.getByRole("heading", { name: "API documentation" }),
  ).toBeVisible();
  // Swagger UI est chargé depuis l'instance (script + CSS), sans CDN.
  await expect(page.getByText("Statisfy API")).toBeVisible({
    timeout: 20_000,
  });

  const spec = await request.get("/api/docs/openapi.json");
  expect(spec.status()).toBe(200);
  const json = (await spec.json()) as {
    openapi: string;
    paths: Record<string, unknown>;
  };
  expect(json.openapi).toBe("3.1.0");
  expect(json.paths["/api/public/stats"]).toBeTruthy();
  expect(json.paths["/api/public/stats/card.svg"]).toBeTruthy();

  const bundle = await request.get("/api/docs/swagger-ui/swagger-ui-bundle.js");
  expect(bundle.status()).toBe(200);
  expect(bundle.headers()["content-type"]).toContain("javascript");
});

test("command palette navigates to a page", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await expect(input).toBeVisible();
  await input.fill("hist");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/history/);
});

test("PWA manifest and generated icon are available", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const json = (await manifest.json()) as {
    start_url: string;
    icons: Array<{ sizes: string }>;
  };
  expect(json.start_url).toBe("/dashboard");
  expect(json.icons.some((icon) => icon.sizes === "192x192")).toBe(true);

  const icon = await request.get("/api/icon?size=192");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
});

test("RUM settings form is visible in the admin area", async ({ page }) => {
  await page.goto("/admin/instance");
  await expect(
    page.getByRole("heading", { name: "Real User Monitoring" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Test connection" }),
  ).toBeVisible();
  await expect(page.getByText("Advanced options")).toBeVisible();
});
