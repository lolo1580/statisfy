import { expect, test } from "@playwright/test";

test("stats API: enable, query, card and revoke", async ({ page, request }) => {
  await page.goto("/settings/data?section=api");

  const card = page
    .locator("div.rounded-2xl")
    .filter({ has: page.getByRole("heading", { name: "API & integrations" }) });
  await card.getByRole("button", { name: "Enable API" }).click();

  const endpointInput = card.locator("input[readonly]").first();
  await expect(endpointInput).toHaveValue(
    /\/api\/public\/stats\?range=30&token=/,
  );
  const endpoint = await endpointInput.inputValue();
  const token = new URL(endpoint).searchParams.get("token");
  expect(token).toBeTruthy();

  const stats = await request.get(`/api/public/stats?range=30&token=${token}`);
  expect(stats.status()).toBe(200);
  const json = (await stats.json()) as {
    user: string;
    allTimePlays: number;
    plays: number;
  };
  expect(json.user).toBe("E2E Admin");
  expect(json.allTimePlays).toBe(0);
  expect(json.plays).toBe(0);

  const cardSvg = await request.get(
    `/api/public/stats/card.svg?theme=light&locale=en&token=${token}`,
  );
  expect(cardSvg.status()).toBe(200);
  expect(cardSvg.headers()["content-type"]).toContain("image/svg+xml");
  expect(await cardSvg.text()).toContain("E2E Admin");

  expect((await request.get("/api/public/stats?token=invalid")).status()).toBe(
    401,
  );

  // Erreurs localisées + code stable pour les clients.
  const unauthorized = await request.get("/api/public/stats?token=invalid", {
    headers: { "accept-language": "fr" },
  });
  expect(unauthorized.status()).toBe(401);
  expect(await unauthorized.json()).toMatchObject({
    code: "unauthorized",
    error: "Non autorisé.",
  });

  const invalidRange = await request.get(
    `/api/public/stats?range=9999&token=${token}`,
    { headers: { "accept-language": "fr" } },
  );
  expect(invalidRange.status()).toBe(400);
  expect(await invalidRange.json()).toMatchObject({
    code: "invalid_range",
  });

  page.on("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Disable API" }).click();
  await expect(card.getByRole("button", { name: "Enable API" })).toBeVisible();
  expect((await request.get(`/api/public/stats?token=${token}`)).status()).toBe(
    401,
  );
});
