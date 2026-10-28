import { expect, test } from "@playwright/test";

test("recap export menu exposes both formats and Instagram sharing", async ({
  page,
}) => {
  await page.goto("/wrapped");
  await expect(page.getByRole("heading", { name: "Recap" })).toBeVisible();

  const trigger = page.getByRole("button", { name: "Export" });
  await trigger.click();

  const menu = page.getByRole("menu", { name: "Export" });
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: /Square image/ }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: /Story image/ }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitem", { name: /Share to Instagram/ }),
  ).toBeVisible();

  const squareDownload = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: /Square image/ }).click();
  const square = await squareDownload;
  expect(square.suggestedFilename()).toMatch(/^statisfy-[^/]+\.png$/);

  await trigger.click();
  const storyDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Story image/ }).click();
  const story = await storyDownload;
  expect(story.suggestedFilename()).toContain("story");

  // Fermeture au clavier.
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
