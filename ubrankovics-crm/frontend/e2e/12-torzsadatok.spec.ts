import { test, expect } from "@playwright/test";
import { shot, uniqueSuffix } from "./helpers";

test.describe("Törzsadatok", () => {
  test("munkanemek, legördülő listák fülek betöltődnek", async ({ page }) => {
    await page.goto("/torzsadatok");
    await expect(page.getByRole("heading", { name: "Törzsadatok" })).toBeVisible();
    await expect(page.getByText("Szerkezet", { exact: true })).toBeVisible();
    await shot(page, "torzsadatok-munkanemek");

    await page.getByRole("button", { name: "Legördülő listák" }).click();
    await expect(page.locator("form")).toBeVisible();
  });

  test("új alvállalkozó felvétele és saját kártyája", async ({ page }) => {
    const nev = `E2E Alvállalkozó ${uniqueSuffix()}`;
    await page.goto("/torzsadatok");
    await page.getByRole("button", { name: "Alvállalkozók" }).click();
    await page.getByPlaceholder("Név").fill(nev);
    await page.getByPlaceholder("Kapcsolat").fill("Teszt Elek");
    await page.getByRole("button", { name: "Hozzáad" }).click();

    await expect(page.locator(`text=${nev}`)).toBeVisible();
    await page.getByRole("link", { name: nev }).click();
    await expect(page).toHaveURL(/\/alvallalkozok\/\d+/);
    await expect(page.getByRole("heading", { name: nev })).toBeVisible();
    await expect(page.getByText("Tételek, amiken vállalóként szerepel")).toBeVisible();
    await expect(page.getByText("Teljesítésigazolások (TIG)")).toBeVisible();
    await expect(page.getByText("Alvállalkozói számlák")).toBeVisible();
    await shot(page, "alvallalkozo-kartya");
  });

  test("új személy felvétele és saját kártyája", async ({ page }) => {
    const nev = `E2E Személy ${uniqueSuffix()}`;
    await page.goto("/torzsadatok");
    await page.getByRole("button", { name: "Személyek", exact: true }).click();
    await page.getByPlaceholder("Név").fill(nev);
    await page.getByRole("button", { name: "Hozzáad" }).click();

    await expect(page.locator(`text=${nev}`)).toBeVisible();
    await page.getByRole("link", { name: nev }).click();
    await expect(page).toHaveURL(/\/szemelyek\/\d+/);
    await expect(page.getByRole("heading", { name: nev })).toBeVisible();
    await expect(page.getByText("Projekt szerepek")).toBeVisible();
    await expect(page.getByText("Kijelölt tételek (ütemezés)")).toBeVisible();
    await shot(page, "szemely-kartya");
  });
});
