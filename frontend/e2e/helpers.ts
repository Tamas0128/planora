import { Page, expect } from "@playwright/test";

export async function login(page: Page) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD not set — expected it to load from the repo-root .env (see playwright.config.ts)."
    );
  }
  await page.goto("/login");
  await page.getByLabel("Jelszó").fill(password);
  await page.getByRole("button", { name: "Bejelentkezés" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
