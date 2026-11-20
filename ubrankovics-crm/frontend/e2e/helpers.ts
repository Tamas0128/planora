import { Page, expect } from "@playwright/test";

export const ADMIN_USER = "admin";
export const ADMIN_PASSWORD = "admin123";

export async function login(page: Page, username = ADMIN_USER, password = ADMIN_PASSWORD) {
  await page.goto("/login");
  // Note (a11y finding): the login labels aren't programmatically associated
  // (no htmlFor/id), so getByLabel() can't find these inputs — positional
  // selectors are the only reliable option here.
  const inputs = page.locator("form input");
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page.getByRole("button", { name: "Bejelentkezés" }).click();
  await expect(page).toHaveURL("/");
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Kijelentkezés" }).click();
  await expect(page).toHaveURL(/\/login/);
}

let shotCounter = 0;

/** Numbered, descriptively-named full-page screenshot into e2e/screenshots/. */
export async function shot(page: Page, name: string) {
  shotCounter += 1;
  const n = String(shotCounter).padStart(2, "0");
  await page.screenshot({ path: `e2e/screenshots/${n}-${name}.png`, fullPage: true });
}

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Creates a project (optionally with an épülettípus, for template auto-generation) and
 * returns its id, parsed from the post-create redirect URL. */
export async function createProjekt(
  page: Page,
  opts: { nev?: string; tipus?: string; utemezesAktiv?: boolean } = {}
): Promise<{ id: number; nev: string }> {
  const nev = opts.nev || `E2E Projekt ${uniqueSuffix()}`;
  await page.goto("/projektek");
  await page.getByRole("button", { name: "Új projekt" }).click();
  await page.getByPlaceholder("Projekt neve").fill(nev);
  if (opts.tipus) {
    await page.locator("select").filter({ hasText: "Épülettípus" }).selectOption({ label: opts.tipus });
  }
  if (opts.utemezesAktiv) {
    await page.locator('input[type="checkbox"]').first().check();
  }
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.locator(`text=${nev}`)).toBeVisible();
  await page.getByRole("link", { name: nev }).click();
  await expect(page).toHaveURL(/\/projektek\/(\d+)/);
  const match = page.url().match(/\/projektek\/(\d+)/);
  const id = Number(match?.[1]);
  return { id, nev };
}
