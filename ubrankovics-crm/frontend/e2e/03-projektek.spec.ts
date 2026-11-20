import { test, expect } from "@playwright/test";
import { createProjekt, shot } from "./helpers";

test.describe("Projektek", () => {
  test("lista betöltődik", async ({ page }) => {
    await page.goto("/projektek");
    await expect(page.getByRole("heading", { name: "Projektek" })).toBeVisible();
    await shot(page, "projektek-lista");
  });

  test("új projekt épülettípus-sablonnal → automatikus tétel-generálás", async ({ page }) => {
    const { nev } = await createProjekt(page, {
      tipus: "Könnyűszerkezetes, üzemben szerelt készház",
      utemezesAktiv: true,
    });
    await expect(page.getByRole("heading", { name: nev })).toBeVisible();
    await expect(page.locator("text=Ütemező aktív")).toBeVisible();
    await shot(page, "projekt-letrehozva-attekintes");

    await page.getByRole("button", { name: "Tételek" }).click();
    await expect(page.locator("text=Ajánlat").first()).toBeVisible();
    const tetelSorok = page.locator("text=Ajánlat");
    expect(await tetelSorok.count()).toBeGreaterThan(15); // ~20 core + 3 type-specific
    await shot(page, "projekt-tetelek-auto-generalt");
  });

  test("projekt fülek közti váltás: Ütemezés, Fázisok, Dokumentumok", async ({ page }) => {
    const { nev } = await createProjekt(page, { utemezesAktiv: true });
    await expect(page.getByRole("heading", { name: nev })).toBeVisible();

    await page.getByRole("button", { name: "Ütemezés" }).click();
    await expect(page.getByText("Átadási határidő")).toBeVisible();
    await shot(page, "projekt-ful-utemezes");

    await page.getByRole("button", { name: "Fázisok" }).click();
    await expect(page.locator("text=/Kész lépések/")).toBeVisible();
    await shot(page, "projekt-ful-fazisok");

    await page.getByRole("button", { name: "Dokumentumok" }).click();
    await expect(page.locator("text=Feltöltés")).toBeVisible();
    await shot(page, "projekt-ful-dokumentumok");
  });

  test("ügyfél hozzárendelése projekthez (Áttekintés fül)", async ({ page }) => {
    const { nev } = await createProjekt(page);
    await expect(page.getByRole("heading", { name: nev })).toBeVisible();
    await expect(page.locator("text=Szerepek")).toBeVisible();
  });
});
