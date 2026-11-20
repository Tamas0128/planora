import path from "path";
import { test, expect } from "@playwright/test";
import { createProjekt, shot } from "./helpers";

const FIXTURE = path.resolve(__dirname, "fixtures/teszt-dokumentum.txt");

test.describe("Dokumentumok (fájlfeltöltés)", () => {
  test("feltöltés, lista, letöltés, törlés", async ({ page }) => {
    const { id } = await createProjekt(page);
    await page.getByRole("button", { name: "Dokumentumok" }).click();
    await page.getByRole("button", { name: "Dokumentum feltöltése" }).click();

    await page.locator("select").selectOption("szerzodes");
    await page.getByPlaceholder("Megjegyzés (opcionális)").fill("E2E teszt feltöltés");
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await page.getByRole("button", { name: "Feltöltés", exact: true }).click();

    await expect(page.locator("text=teszt-dokumentum.txt")).toBeVisible();
    await expect(page.locator("text=E2E teszt feltöltés")).toBeVisible();
    await shot(page, `projekt-${id}-dokumentum-feltoltve`);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Letöltés" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("teszt-dokumentum.txt");

    const row = page.locator("li", { hasText: "teszt-dokumentum.txt" });
    page.once("dialog", (d) => d.accept());
    await row.locator("button").last().click();
    await expect(page.locator("text=teszt-dokumentum.txt")).toHaveCount(0);
  });

  test("nem engedélyezett fájltípus elutasítása (kliens oldali validáció hiányában a backend 400-at ad)", async ({
    page,
    request,
  }) => {
    const { id } = await createProjekt(page);
    const token = await page.evaluate(() => localStorage.getItem("access_token"));
    const resp = await request.post(`/api/projektek/${id}/dokumentumok`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        tipus: "egyeb",
        file: { name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") },
      },
    });
    expect(resp.status()).toBe(400);
  });
});
