import { test, expect } from "@playwright/test";
import { shot, uniqueSuffix } from "./helpers";

test.describe("Ügyfelek", () => {
  test("lista betöltődik", async ({ page }) => {
    await page.goto("/ugyfelek");
    await expect(page.getByRole("heading", { name: "Ügyfelek" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await shot(page, "ugyfelek-lista");
  });

  test("új ügyfél létrehozása, szerkesztése és a kapcsolódó-projekt kártya", async ({ page }) => {
    const nev = `E2E Ügyfél ${uniqueSuffix()}`;
    await page.goto("/ugyfelek");
    await page.getByRole("button", { name: "Új ügyfél" }).click();
    await page.getByPlaceholder("Név").fill(nev);
    await page.getByPlaceholder("Telefon").fill("+36201112233");
    await page.getByPlaceholder("E-mail").fill("e2e@example.com");
    await page.getByRole("button", { name: "Mentés" }).first().click();

    await expect(page.locator(`text=${nev}`)).toBeVisible();
    await shot(page, "ugyfelek-uj-letrehozva");

    await page.getByRole("link", { name: nev }).click();
    await expect(page).toHaveURL(/\/ugyfelek\/\d+/);
    await expect(page.getByRole("heading", { name: nev })).toBeVisible();

    // A kártyán meg kell jelennie egy "Projektek" szekciónak (korábbi hiba: ez üres/hiányzó volt).
    await expect(page.getByRole("heading", { name: "Projektek" })).toBeVisible();
    await shot(page, "ugyfel-kartya-projektek-szekcio");

    const nameInput = page.locator("input").first();
    await nameInput.fill(`${nev} (szerkesztve)`);
    await page.getByRole("button", { name: "Mentés" }).first().click();
    await expect(page.getByRole("heading", { name: `${nev} (szerkesztve)` })).toBeVisible();
  });

  test("ügyfél törlése", async ({ page }) => {
    const nev = `E2E Törlendő ${uniqueSuffix()}`;
    await page.goto("/ugyfelek");
    await page.getByRole("button", { name: "Új ügyfél" }).click();
    await page.getByPlaceholder("Név").fill(nev);
    await page.getByRole("button", { name: "Mentés" }).first().click();
    await expect(page.locator(`text=${nev}`)).toBeVisible();

    await page.getByRole("link", { name: nev }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Törlés", exact: true }).click();
    await expect(page).toHaveURL(/\/ugyfelek$/);
    await expect(page.locator(`text=${nev}`)).toHaveCount(0);
  });
});
