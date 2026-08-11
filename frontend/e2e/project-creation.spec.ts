import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("create a project through the wizard and see its auto-generated schedule", async ({ page }) => {
  await login(page);

  await page.goto("/projects");
  await page.getByRole("button", { name: "Új projekt" }).click();

  const projectName = `E2E Teszt Ház ${Date.now()}`;
  await page.getByLabel("Projekt neve").fill(projectName);
  await page.getByLabel("Település").fill("Szeged");
  await page.getByLabel("Cím").fill("Teszt utca 1.");
  await page.getByRole("button", { name: "Tovább" }).click();

  await page.getByLabel("Ügyfél neve").fill("E2E Teszt Ügyfél");
  await page.getByRole("button", { name: "Tovább" }).click();

  // Step 2 (Épület) keeps its defaults (145 m², könnyűszerkezetes).
  await page.getByRole("button", { name: "Tovább" }).click();

  // Step 3 (Átadás) keeps its default delivery date and "Ütemezett feladatokkal".
  await page.getByRole("button", { name: "Létrehozás" }).click();

  await expect(page).toHaveURL(/\/projects\/\d+/);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  await page.getByRole("tab", { name: "Ütemterv" }).click();
  // The backward-scheduling engine auto-generates the default activity list —
  // assert the activity count badge shows more than zero.
  const countText = await page.getByText(/\d+ tevékenység/).textContent();
  const count = parseInt(countText?.match(/\d+/)?.[0] ?? "0", 10);
  expect(count).toBeGreaterThan(0);
});
