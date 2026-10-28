import { expect, test } from "@playwright/test";

function profileCard(page: import("@playwright/test").Page) {
  return page
    .locator("div.rounded-2xl")
    .filter({ has: page.getByRole("heading", { name: "Public profile" }) });
}

test("public profile exposes only the selected sections", async ({ page }) => {
  await page.goto("/settings/data?section=sharing");

  await profileCard(page)
    .getByRole("button", { name: "Enable sharing" })
    .click();
  const linkInput = profileCard(page).locator("input[readonly]");
  await expect(linkInput).toHaveValue(/\/share\/profile\//);
  const publicPath = new URL(await linkInput.inputValue()).pathname;

  await page.goto(publicPath);
  await expect(page.getByRole("heading", { name: "E2E Admin" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Top artists" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top tracks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent plays" })).toHaveCount(
    0,
  );

  // Active « Recent plays » puis vérifie que la section apparaît.
  await page.goto("/settings/data?section=sharing");
  await profileCard(page).getByLabel("Recent plays").check();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    profileCard(page).getByRole("button", { name: "Save sections" }).click(),
  ]);

  await page.goto(publicPath);
  await expect(
    page.getByRole("heading", { name: "Recent plays" }),
  ).toBeVisible();

  // Désactive le partage : le lien ne doit plus fonctionner.
  await page.goto("/settings/data?section=sharing");
  page.on("dialog", (dialog) => dialog.accept());
  await profileCard(page)
    .getByRole("button", { name: "Disable sharing" })
    .click();
  await expect(
    profileCard(page).getByRole("button", { name: "Enable sharing" }),
  ).toBeVisible();

  const response = await page.request.get(publicPath);
  expect(response.status()).toBe(404);
});
