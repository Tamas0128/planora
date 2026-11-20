import { test, expect } from "@playwright/test";
import { createProjekt, shot, uniqueSuffix } from "./helpers";

test.describe("Pénzügy", () => {
  test("gördülő cash-flow előrejelzés: hét/hónap váltás, drill-down", async ({ page }) => {
    await page.goto("/penzugy");
    await expect(page.getByRole("heading", { name: "Pénzügy" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await shot(page, "penzugy-cashflow-het");

    await page.locator("select").first().selectOption("honap");
    await expect(page.locator("table")).toBeVisible();
    await shot(page, "penzugy-cashflow-honap");

    await page.locator("select").first().selectOption("het");
    await page.locator("table tbody tr").first().click();
    await expect(page.locator("text=/Nincs tétel|bevétel|kiadás/i").first()).toBeVisible();
  });

  test("bankegyenleg rögzítése frissíti a nyitó egyenleget", async ({ page }) => {
    await page.goto("/penzugy");
    const datum = new Date().toISOString().slice(0, 10);
    await page.locator('input[type="date"]').first().fill(datum);
    await page.getByPlaceholder("Egyenleg (Ft)").fill("9999000");
    await page.getByRole("button", { name: "Mentés" }).click();
    await expect(page.getByText("Legutóbbi rögzített egyenleg")).toContainText("9 999 000");
  });

  test("szerződés + ütemezett részlet létrehozása, majd számla kiállítása", async ({ page }) => {
    const { id: projektId } = await createProjekt(page);
    await page.goto("/penzugy");
    await page.getByRole("button", { name: "Szerződések" }).click();
    await page.locator("select").selectOption(String(projektId));
    await page.getByRole("button", { name: "Új szerződés" }).click();

    const szam = `E2E-SZ-${uniqueSuffix()}`;
    await page.locator("select").nth(1).selectOption({ index: 1 }); // ügyfél
    await page.getByPlaceholder("Szerződésszám").fill(szam);
    await page.getByPlaceholder("Összeg (nettó, Ft)").fill("5000000");
    await page.locator('input[type="date"]').nth(0).fill("2026-11-01");
    await page.locator('input[type="date"]').nth(1).fill("2027-03-01");

    await page.getByRole("button", { name: "+ Részlet" }).click();
    await page.getByPlaceholder("Megnevezés").fill("Előleg");
    await page.getByPlaceholder("Összeg", { exact: true }).fill("1000000");
    await page.locator('input[type="date"]').nth(2).fill("2026-12-01");

    await page.getByRole("button", { name: "Szerződés létrehozása" }).click();
    await expect(page.locator(`text=${szam}`)).toBeVisible();
    await shot(page, `penzugy-szerzodes-${projektId}`);

    await page.getByRole("button", { name: "Számla kiállítása" }).click();
    await page.getByPlaceholder("Számlaszám").fill(`E2E-SZAMLA-${uniqueSuffix()}`);
    const kiallitasDateInputs = page.locator('input[type="date"]');
    await kiallitasDateInputs.nth(0).fill("2026-12-01");
    await kiallitasDateInputs.nth(1).fill("2026-12-01");
    await kiallitasDateInputs.nth(2).fill("2026-12-15");
    await page.getByRole("button", { name: "Kiállítás", exact: true }).click();
    await expect(page.locator("text=/Számlázva/")).toBeVisible();
    await shot(page, `penzugy-szamla-kiallitva-${projektId}`);
  });

  test("TIG rögzítése és alvállalkozói számla hátralék-számítása", async ({ page }) => {
    const { id: projektId } = await createProjekt(page);
    await page.goto("/penzugy");
    await page.getByRole("button", { name: "TIG + számlák" }).click();
    await page.locator("select").selectOption(String(projektId));

    await page.locator("select").nth(1).selectOption({ index: 1 }); // alvállalkozó
    await page.locator('input[type="date"]').nth(0).fill("2026-11-15");
    await page.locator('input[type="date"]').nth(1).fill("2026-11-01");
    await page.locator('input[type="date"]').nth(2).fill("2026-11-15");
    await page.getByPlaceholder("Nettó (Ft)").first().fill("800000");
    await page.getByRole("button", { name: "TIG rögzítése" }).click();
    await expect(page.locator("span", { hasText: "2026-11-01" })).toBeVisible();
    await shot(page, `penzugy-tig-${projektId}`);
  });
});
