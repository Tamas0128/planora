import { test, expect, APIRequestContext } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_USER, uniqueSuffix } from "./helpers";

async function auth(request: APIRequestContext) {
  const r = await request.post("/api/auth/login/json", { data: { username: ADMIN_USER, password: ADMIN_PASSWORD } });
  const { access_token } = await r.json();
  return { Authorization: `Bearer ${access_token}` };
}

test.describe("Projekten belüli munka: feladatok, naptár, ütemező-admin", () => {
  test("Feladat felvétele és késznek jelölése a projekt Feladatok fülén; a Naptár fül mutatja", async ({ page, request }) => {
    const headers = await auth(request);
    const p = await (await request.post("/api/projektek", { data: { projekt_nev: `E2E Belül ${uniqueSuffix()}` }, headers })).json();
    await page.goto(`/projektek/${p.id}`);

    await page.getByRole("button", { name: "Feladatok", exact: true }).click();
    const cim = `Belső feladat ${uniqueSuffix()}`;
    const ma = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Feladat címe").fill(cim);
    await page.getByLabel("Határidő").fill(ma);
    await page.getByRole("button", { name: "Feladat hozzáadása" }).click();
    await expect(page.getByTestId("projekt-feladatok").getByText(cim)).toBeVisible();

    await page.getByRole("button", { name: "Naptár", exact: true }).click();
    await expect(page.getByTestId("naptar-lista").getByText(cim)).toBeVisible();

    // a naptári feladat aktív: kattintásra modalban nyílik a részlet, ott késznek jelölhető
    await page.getByTestId("naptar-lista").getByRole("button", { name: cim }).click();
    const modal = page.getByRole("button", { name: "Bezárás" }).locator("xpath=ancestor::div[contains(@class,'max-w-md')]");
    await expect(modal.getByText(cim)).toBeVisible();
    await expect(modal.getByLabel("Kész")).not.toBeChecked();
    await modal.getByRole("button", { name: "Bezárás" }).click();
    await expect(modal).toHaveCount(0);

    await page.getByRole("button", { name: "Feladatok", exact: true }).click();
    await page.getByLabel(`${cim} kész`).click();
    await expect(page.getByLabel(`${cim} kész`)).toBeChecked();
  });

  test("Gyors feladatrögzítés a lebegő gombbal, bármelyik fülről", async ({ page, request }) => {
    const headers = await auth(request);
    const p = await (await request.post("/api/projektek", { data: { projekt_nev: `E2E Gyors ${uniqueSuffix()}` }, headers })).json();
    await page.goto(`/projektek/${p.id}`);
    await page.getByRole("button", { name: "Tételek", exact: true }).click();
    await page.getByRole("button", { name: "Új feladat" }).click();
    const cim = `Helyszíni feladat ${uniqueSuffix()}`;
    await page.getByLabel("Mit kell megcsinálni?").fill(cim);
    await page.getByRole("button", { name: "Feladat rögzítése" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Feladat rögzítve" })).toBeVisible();
    await page.getByRole("button", { name: "Feladatok", exact: true }).click();
    await expect(page.getByTestId("projekt-feladatok").getByText(cim)).toBeVisible();
  });

  test("Az ütemező be-/kikapcsolható a Beállítások fülön, az alapadatok menthetők", async ({ page, request }) => {
    const headers = await auth(request);
    const nev = `E2E Beállítás ${uniqueSuffix()}`;
    const p = await (await request.post("/api/projektek", { data: { projekt_nev: nev }, headers })).json();
    await page.goto(`/projektek/${p.id}`);

    await page.getByRole("button", { name: "Beállítások", exact: true }).click();
    const kapcsolo = page.getByLabel("Ütemező aktív ennél a projektnél");
    const elozo = await kapcsolo.isChecked();
    await kapcsolo.click();
    await expect(kapcsolo).toBeChecked({ checked: !elozo });

    await page.getByLabel("Projekt neve").fill(nev + " (átnevezve)");
    await page.getByLabel("Átadási határidő").fill("2027-03-15");
    await page.getByRole("button", { name: "Mentés" }).click();
    await expect(page.getByRole("status")).toHaveText("Mentve.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("(átnevezve)");

    // az Ütemezés fül mostantól elérhető
    await page.getByRole("button", { name: "Ütemezés", exact: true }).click();
    await expect(page.getByText("Ütemező bekapcsolása")).toHaveCount(elozo ? 1 : 0);
  });

  test("Felső keret: négy terület, almenü és értesítés", async ({ page }) => {
    await page.goto("/projektek");
    const fomenu = page.getByRole("navigation", { name: "Főmenü" });
    for (const n of ["Értékesítés", "Projektek", "Pénzügy", "Rendszer beállítások"]) {
      await expect(fomenu.getByRole("link", { name: n })).toBeVisible();
    }
    const almenu = page.getByRole("navigation", { name: "Projektek almenü" });
    await expect(almenu.getByRole("link", { name: "Naptár" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "Értesítések" })).toBeVisible();
  });
});
