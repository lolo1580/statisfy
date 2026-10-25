import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";

/** Compte administrateur créé une fois, réutilisé par les autres tests. */
const AUTH_FILE = "e2e/.auth/admin.json";
const EMAIL = "e2e@example.com";
const PASSWORD = "e2e-password-1";

/**
 * Le setup doit rester idempotent : en cas de retry (ou de base non recréée),
 * le compte peut déjà exister. On tente l'inscription puis, si le message
 * « compte existant » apparaît, on se connecte.
 */
setup("create the administrator account", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("E2E Admin");
  await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  // Attend le résultat de l'action : redirection (succès) ou message d'erreur.
  const outcome = await Promise.race([
    page
      .waitForURL(/\/dashboard/, { timeout: 20_000 })
      .then(() => "registered" as const)
      .catch(() => null),
    page
      .getByText("An account already exists with this address.")
      .waitFor({ timeout: 20_000 })
      .then(() => "exists" as const)
      .catch(() => null),
  ]);

  if (outcome === "exists") {
    await page.goto("/login");
    await page.getByLabel("Email address", { exact: true }).fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // Ferme le didacticiel de bienvenue. On attend que React ait attaché ses
  // gestionnaires (utile en développement, sans effet en production).
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await page.waitForFunction(
      () => {
        const button = document.querySelector<HTMLElement>(
          '[role="dialog"] button',
        );
        if (!button) return true;
        return Object.keys(button).some(
          (key) =>
            key.startsWith("__reactFiber$") || key.startsWith("__reactProps$"),
        );
      },
      undefined,
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(dialog).toBeHidden();
  }

  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
