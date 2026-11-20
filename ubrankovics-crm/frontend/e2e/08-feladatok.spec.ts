import { test, expect } from "@playwright/test";
import { shot, uniqueSuffix } from "./helpers";

test.describe("Feladatok", () => {
  test("új feladat létrehozása, kész jelölés, szűrők", async ({ page }) => {
    await page.goto("/feladatok");
    await expect(page.getByRole("heading", { name: "Feladatok" })).toBeVisible();
    await page.getByText("Csak az enyém").click(); // felelős nélkül jön létre a teszt-feladat, lásd lentebb

    const cim = `E2E feladat ${uniqueSuffix()}`;
    await page.getByRole("button", { name: "Új feladat" }).click();
    await page.getByPlaceholder("Cím").fill(cim);
    await page.getByPlaceholder("Leírás (opcionális)").fill("E2E teszt leírás");
    await page.locator('input[type="date"]').fill("2026-12-31");
    await page.getByRole("button", { name: "Létrehozás" }).click();

    await expect(page.locator(`text=${cim}`)).toBeVisible();
    await shot(page, "feladatok-uj-letrehozva");

    const row = page.locator("li", { hasText: cim });
    await row.locator('input[type="checkbox"]').click();
    await expect(page.locator(`text=${cim}`)).toHaveCount(0);

    await page.getByText("Kész feladatok is").click();
    await expect(page.locator(`text=${cim}`)).toBeVisible();
    await shot(page, "feladatok-kesz-szures");
  });

  test("lejárt határidő piros kiemeléssel jelenik meg", async ({ page }) => {
    const cim = `E2E lejárt ${uniqueSuffix()}`;
    await page.goto("/feladatok");
    await page.getByText("Csak az enyém").click();
    await page.getByRole("button", { name: "Új feladat" }).click();
    await page.getByPlaceholder("Cím").fill(cim);
    await page.locator('input[type="date"]').fill("2020-01-01");
    await page.getByRole("button", { name: "Létrehozás" }).click();

    const row = page.locator("li", { hasText: cim });
    await expect(row.locator("text=2020-01-01")).toHaveClass(/text-\[var\(--danger\)\]|font-semibold/);
    await shot(page, "feladatok-lejart-piros");
  });
});
