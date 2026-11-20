import { test, expect } from "@playwright/test";
import { createProjekt, shot } from "./helpers";

test.describe("Ütemezés", () => {
  test("átadási határidő mentése, újraütemezés, Gantt PDF letöltés", async ({ page }) => {
    const { id } = await createProjekt(page, {
      tipus: "Boronafalas gerendaház",
      utemezesAktiv: true,
    });
    await page.getByRole("button", { name: "Ütemezés" }).click();

    const hatarido = page.locator('input[type="date"]').first();
    await hatarido.fill("2027-06-01");
    await page.getByRole("button", { name: "Mentés" }).click();
    await page.getByRole("button", { name: "Újraütemezés" }).click();

    await expect(page.locator("table")).toBeVisible();
    // A sablon-függőségek miatt legalább egy tételnek lennie kell terv-dátumának.
    await expect(page.locator("text=/202[67]-\\d{2}-\\d{2}/").first()).toBeVisible({ timeout: 10_000 });
    await shot(page, `projekt-${id}-utemezes-szamolva`);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Gantt PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("felelős szerep és kijelölt személy hozzárendelése egy tételhez", async ({ page }) => {
    await createProjekt(page, { tipus: "Könnyűszerkezetes, üzemben szerelt készház", utemezesAktiv: true });
    await page.getByRole("button", { name: "Ütemezés" }).click();

    const felelosSelect = page.locator("table select").first();
    await felelosSelect.selectOption({ index: 1 });

    const kijeloltSelect = page.locator("table select").nth(1);
    await kijeloltSelect.selectOption({ index: 1 });

    await expect(felelosSelect).not.toHaveValue("");
    await expect(kijeloltSelect).not.toHaveValue("");
  });
});
