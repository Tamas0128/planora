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

  test("Elfogadott ajánlat soraiból beszerzési igény lesz a Tételek között (átemelés)", async ({ page, request }) => {
    const headers = await auth(request);
    const p = await (await request.post("/api/projektek", { data: { projekt_nev: `E2E Átemelés ${uniqueSuffix()}` }, headers })).json();
    const a = await (await request.post(`/api/projektek/${p.id}/ajanlatok`, {
      data: { cim: "Fürdő", sorok: [{ megnevezes: "Egyedi csempézés", mennyiseg: 10, egyseg: "m2", egysegar: 5000 }] },
      headers,
    })).json();
    await request.patch(`/api/ajanlat-verziok/${a.verziok[0].id}/allapot`, { data: { allapot: "elfogadva" }, headers });
    await page.goto(`/projektek/${p.id}`);
    await page.getByRole("button", { name: "Szerződés", exact: true }).click();
    await page.getByRole("button", { name: "Átemelés a Tételekbe" }).click();
    await page.getByLabel("Egyedi csempézés munkanem").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Átemelés (1 sor)" }).click();
    await expect(page.getByRole("status").filter({ hasText: "1 beszerzési igény" })).toBeVisible();
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

test.describe("Folyamat-nézet, Szerződés fül, Excel-átvétel", () => {
  test("Tételek folyamat-mátrix: egy cella állapota lép; a Szerződés fül CR-t és összképet mutat", async ({ page, request }) => {
    const headers = await auth(request);
    const p = await (await request.post("/api/projektek", { data: { projekt_nev: `E2E Folyamat ${uniqueSuffix()}` }, headers })).json();
    const mn = (await (await request.get("/api/munkanemek", { headers })).json())[0];
    await request.post(`/api/projektek/${p.id}/tetelek`, { data: { munkanem_id: mn.id }, headers });
    await page.goto(`/projektek/${p.id}`);
    await page.getByRole("button", { name: "Tételek", exact: true }).click();
    const cella = page.getByRole("button", { name: new RegExp(`${mn.nev}, Ajánlatkérés: üres`) });
    await cella.click();
    await expect(page.getByRole("button", { name: new RegExp(`${mn.nev}, Ajánlatkérés: folyamatban`) })).toBeVisible();

    await request.post(`/api/projektek/${p.id}/ajanlatok`, { data: { cim: "Alap", sorok: [{ megnevezes: "x", mennyiseg: 1, egysegar: 1000000 }] }, headers });
    await request.post(`/api/projektek/${p.id}/ajanlatok`, { data: { cim: "Terasz", cr_azonosito: "CR-1", sorok: [{ megnevezes: "y", mennyiseg: 1, egysegar: 200000 }] }, headers });
    await page.getByRole("button", { name: "Szerződés", exact: true }).click();
    await expect(page.getByTestId("szerzodes-osszkep")).toContainText("Teljes szerződéses érték");
    await expect(page.getByText("Pótmunka CR-1")).toBeVisible();
  });

  test("Excel-átvétel: üres sablonra érthető hibát ad", async ({ page }) => {
    await page.goto("/projektek/import");
    await page.locator('input[type="file"]').setInputFiles("../docs/excel-sablon/Ubrankovics_projekt_alap.xlsx");
    await page.getByRole("button", { name: "Előnézet" }).click();
    // a sablonban nincs projektnév: érthető hibát várunk
    await expect(page.getByRole("alert").filter({ hasText: "kötelező" })).toBeVisible();
  });
});
