import { test, expect, APIRequestContext } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_USER, shot, uniqueSuffix } from "./helpers";

let cachedAuth: { Authorization: string } | null = null;

// Egyszer lépünk be API-n át, hogy ne fussunk a belépési rate limitbe.
async function auth(request: APIRequestContext) {
  if (cachedAuth) return cachedAuth;
  const r = await request.post("/api/auth/login/json", { data: { username: ADMIN_USER, password: ADMIN_PASSWORD } });
  const { access_token } = await r.json();
  cachedAuth = { Authorization: `Bearer ${access_token}` };
  return cachedAuth;
}

/** Projekt egy ügyféllel, API-n át felvéve (a UI-s felvételt a 03-es spec fedi). */
async function ujProjekt(request: APIRequestContext, extra: Record<string, unknown> = {}) {
  const headers = await auth(request);
  const u = await request.post("/api/ugyfelek", { data: { nev: `E2E Életciklus ${uniqueSuffix()}` }, headers });
  const ugyfel = await u.json();
  const p = await request.post("/api/projektek", {
    data: { projekt_nev: `E2E Életciklus ${uniqueSuffix()}`, ugyfelek: [{ ugyfel_id: ugyfel.id }], ...extra },
    headers,
  });
  expect(p.ok()).toBeTruthy();
  return (await p.json()) as { id: number; projekt_nev: string };
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("Projekt életciklus", () => {
  test("Átadás: jegyzőkönyv, aláírás, garanciális hibabejelentés", async ({ page, request }) => {
    const p = await ujProjekt(request);
    await page.goto(`/projektek/${p.id}`);
    await page.getByRole("button", { name: "Átadás" }).click();

    // aláírás előtt a hibabejelentés tiltott, erről szól a tájékoztatás
    await expect(page.getByText(/Hibabejelentéshez érvényes garancia kell/)).toBeVisible();

    await page.getByLabel("Átadó").fill("Ubrankovics Kft.");
    await page.getByLabel("Átvevő").fill("Teszt Elek");
    await page.getByRole("button", { name: "Jegyzőkönyv rögzítése" }).click();
    const lista = page.getByTestId("atvetel-lista");
    await expect(lista.getByText("Tervezet")).toBeVisible();

    await lista.getByRole("button", { name: "Aláírás rögzítése" }).click();
    await expect(lista.getByText("Aláírva")).toBeVisible();
    await expect(lista.getByText(/Garancia érvényes/)).toBeVisible();

    await page.getByLabel("Hiba rövid leírása").fill("Beázik a tető");
    await page.getByRole("button", { name: "Hiba bejelentése" }).click();
    await expect(page.getByTestId("garancia-jegyek").getByText("Garanciális hiba: Beázik a tető")).toBeVisible();
    await shot(page, "projekt-atadas-garancia");
  });

  test("Vevői ajánlat: új verzió és változás-összehasonlítás", async ({ page, request }) => {
    const p = await ujProjekt(request);
    await page.goto(`/projektek/${p.id}`);
    await page.getByRole("button", { name: "Szerződés", exact: true }).click();

    await page.getByLabel("Ajánlat címe").fill("Családi ház");
    await page.getByLabel("Megnevezés").fill("Alapozás");
    await page.getByLabel("Menny.").fill("10");
    await page.getByLabel("Egységár (Ft)").fill("20000");
    await page.getByRole("button", { name: /Ajánlat létrehozása/ }).click();

    const kartya = page.getByRole("article", { name: "Ajánlat: Családi ház" });
    await expect(kartya).toContainText("v1");
    await expect(kartya).toContainText("200 000");

    await kartya.getByRole("button", { name: "Új verzió készítése" }).click();
    const urlap = kartya.getByRole("form", { name: "Új verzió" });
    await urlap.getByLabel("Egységár (Ft)").fill("18000");
    await urlap.getByLabel("Mi változott?").fill("Kedvezmény");
    await urlap.getByRole("button", { name: "Verzió mentése" }).click();

    await expect(kartya).toContainText("v2");
    await expect(kartya.getByTestId("verzio-diff")).toContainText("Változás v1 → v2");
    await expect(kartya.getByTestId("verzio-diff")).toContainText("20 000");
    await shot(page, "projekt-ajanlat-verziok");

    await kartya.getByRole("button", { name: "Elfogadva" }).click();
    await expect(kartya).toContainText("Elfogadva");
    await expect(kartya.getByRole("button", { name: "Új verzió készítése" })).toHaveCount(0);
  });

  test("Naptár: esemény megjelenik, iCal letölthető", async ({ page, request }) => {
    const headers = await auth(request);
    const cim = `Naptár feladat ${uniqueSuffix()}`;
    const ma = new Date().toISOString().slice(0, 10);
    const r = await request.post("/api/feladatok", { data: { cim, hatarido: ma }, headers });
    expect(r.ok()).toBeTruthy();

    await page.goto("/naptar");
    await expect(page.getByRole("heading", { name: "Naptár" })).toBeVisible();
    await expect(page).toHaveTitle(/^Naptár – Ubrankovics CRM$/);
    expect(await page.getByRole("row").count()).toBeGreaterThanOrEqual(5); // fejléc + a hónap hetei
    expect((await page.getByRole("gridcell").count()) % 7).toBe(0);

    await expect(page.getByTestId("naptar-lista").getByText(cim)).toBeVisible();

    const [letoltes] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /iCal exportálás/ }).click(),
    ]);
    expect(letoltes.suggestedFilename()).toBe("ubrankovics-naptar.ics");
    await shot(page, "naptar");
  });

  test("Elfelejtett jelszó: kérés általános válasszal", async ({ browser }) => {
    const ctx = await browser.newContext(); // nincs bejelentkezés
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByRole("link", { name: "Elfelejtettem a jelszavam" }).click();
    await expect(page).toHaveURL(/elfelejtett-jelszo/);
    await page.getByLabel("Felhasználónév vagy e-mail").fill("nem-letezo-felhasznalo");
    await page.getByRole("button", { name: "Link kérése" }).click();
    await expect(page.getByTestId("reset-kerve")).toContainText("Ha a megadott fiók létezik");

    // érvénytelen token: az új jelszó oldal hibát ad, nem lép be
    await page.goto("/uj-jelszo?token=ervenytelen-token-12345");
    await page.getByLabel("Új jelszó (min. 8 karakter)").fill("ujjelszo123");
    await page.getByLabel("Jelszó újra").fill("ujjelszo123");
    await page.getByRole("button", { name: "Jelszó mentése" }).click();
    await expect(page.getByText(/A link érvénytelen vagy lejárt/)).toBeVisible();
    await ctx.close();
  });

  test("Fiókom: 2FA beállítás indítható, kulcsot mutat", async ({ page }) => {
    await page.goto("/fiok");
    await expect(page.getByRole("heading", { name: "Fiókom" })).toBeVisible();
    await page.getByRole("button", { name: "Beállítás indítása" }).click();
    await expect(page.getByRole("img", { name: /QR-kód/ })).toBeVisible();
    await expect(page.getByTestId("tfa-kulcs")).toHaveValue(/^[A-Z2-7]{32}$/);
    // a bekapcsolást szándékosan nem végezzük el: az admin belépés a többi tesztben kód nélkül működik
  });

  test("Saját 404 oldal", async ({ page }) => {
    await page.goto("/nincs-ilyen-oldal");
    await expect(page.getByRole("heading", { name: "Az oldal nem található" })).toBeVisible();
    await page.getByRole("link", { name: "Vissza a kezdőlapra" }).click();
    await expect(page).toHaveURL("/");
  });
});
