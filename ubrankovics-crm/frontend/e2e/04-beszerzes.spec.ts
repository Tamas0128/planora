import { test, expect } from "@playwright/test";
import { createProjekt, shot, uniqueSuffix } from "./helpers";

test.describe("Tétel-részletező és beszerzési (RFQ/PO) folyamat", () => {
  test("tétel hozzáadása, vállalás, esemény, specifikáció", async ({ page }) => {
    const { id } = await createProjekt(page);
    await page.getByRole("button", { name: "Tételek" }).click();

    const munkanemSelect = page.locator("select").first();
    const munkanemNev = (await munkanemSelect.locator("option").nth(1).textContent())!.trim();
    await munkanemSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Tétel", exact: true }).click();

    await page.getByRole("button", { name: munkanemNev }).click();

    await expect(page.getByText("Vállalások")).toBeVisible();
    await page.getByRole("button", { name: "Vállaló hozzáadása" }).click();
    await expect(page.locator("li", { hasText: "Saját" })).toBeVisible();
    await shot(page, `projekt-${id}-tetel-reszletezo`);

    await page.getByRole("button", { name: "Esemény rögzítése" }).click();
    await expect(page.locator("text=/Ajánlatkérés/").first()).toBeVisible();

    await page.getByPlaceholder("Kulcs (pl. Gyártó)").fill("Gyártó");
    await page.getByPlaceholder("Érték").fill("Teszt Gyártó Kft.");
    await page.getByRole("button", { name: "Hozzáadás", exact: true }).click();
    await expect(page.locator("text=Teszt Gyártó Kft.")).toBeVisible();
  });

  test("beszerzési igény → ajánlatkérés → ajánlat → kiválasztás → ügyfél ár", async ({ page }) => {
    const { id } = await createProjekt(page);
    await page.getByRole("button", { name: "Tételek" }).click();
    const munkanemSelect = page.locator("select").first();
    const munkanemNev = (await munkanemSelect.locator("option").nth(1).textContent())!.trim();
    await munkanemSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Tétel", exact: true }).click();
    await page.getByRole("button", { name: munkanemNev }).click();

    const megnevezes = `E2E anyag ${uniqueSuffix()}`;
    await page.getByPlaceholder("Megnevezés (pl. Ablak - nappali)").fill(megnevezes);
    await page.getByPlaceholder("Mennyiség").fill("5");
    await page.getByPlaceholder("Me.").fill("db");
    await page.getByRole("button", { name: "Beszerzési igény hozzáadása" }).click();
    await expect(page.locator(`text=${megnevezes}`)).toBeVisible();

    await page.locator("button", { hasText: megnevezes }).click();
    await shot(page, `projekt-${id}-beszerzesi-igeny`);

    await page.getByPlaceholder("Cimzett neve").fill("Teszt Beszállító Kft.");
    await page.getByRole("button", { name: "Ajánlatkérés kiküldése" }).click();
    await expect(page.locator("text=Teszt Beszállító Kft.")).toBeVisible();

    await page.getByPlaceholder("Nettó").first().fill("100000");
    await page.getByRole("button", { name: "+ Ajánlat" }).click();
    await expect(page.locator("text=/127\\s*000|100\\s*000/").first()).toBeVisible();
    await shot(page, `projekt-${id}-ajanlat-beerkezett`);

    await page.getByRole("button", { name: "Kiválasztás" }).click();
    await expect(page.locator("text=/kiválasztva/")).toBeVisible();

    const ugyfelArForm = page.locator("form").filter({ has: page.getByPlaceholder("Nettó") }).last();
    await ugyfelArForm.getByPlaceholder("Nettó").fill("150000");
    await ugyfelArForm.getByRole("button", { name: "Mentés" }).click();
    await expect(page.locator("text=/190\\s*500|150\\s*000/").first()).toBeVisible();
    await shot(page, `projekt-${id}-ugyfel-ar-mentve`);
  });
});
