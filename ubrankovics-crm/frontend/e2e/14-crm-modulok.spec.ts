import { test, expect, APIRequestContext } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_USER, shot, uniqueSuffix } from "./helpers";

let cachedAuth: { Authorization: string } | null = null;

// Egyszer lépünk be API-n át, hogy ne fussunk a belépési rate limitbe.
async function auth(request: APIRequestContext) {
  if (cachedAuth) return cachedAuth;
  const r = await request.post("/api/auth/login/json", { data: { username: ADMIN_USER, password: ADMIN_PASSWORD } });
  expect(r.ok()).toBeTruthy();
  const { access_token } = await r.json();
  cachedAuth = { Authorization: `Bearer ${access_token}` };
  return cachedAuth;
}

async function ujUgyfel(request: APIRequestContext, nev: string) {
  const r = await request.post("/api/ugyfelek", { data: { nev, email: `${uniqueSuffix()}@example.com` }, headers: await auth(request) });
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as { id: number; nev: string };
}

test.describe("CRM modulok", () => {
  test("Érdeklődők: felvétel és szakasz váltás", async ({ page }) => {
    const nev = `E2E Lead ${uniqueSuffix()}`;
    await page.goto("/erdeklodok");
    await expect(page.getByRole("heading", { name: "Érdeklődők" })).toBeVisible();
    await page.getByRole("button", { name: "Új érdeklődő" }).click();
    await page.getByLabel("Név", { exact: true }).fill(nev);
    await page.getByRole("button", { name: "Mentés" }).click();
    const uj = page.getByTestId("oszlop-uj");
    await expect(uj.getByText(nev)).toBeVisible();

    await page.getByLabel(`${nev} szakasz`).selectOption("targyalas");
    await expect(page.getByTestId("oszlop-targyalas").getByText(nev)).toBeVisible();
    await shot(page, "erdeklodok-pipeline");
  });

  test("Jegyek: új jegy rögzítése és állapotváltás", async ({ page, request }) => {
    const ugyfel = await ujUgyfel(request, `E2E Jegy Ügyfél ${uniqueSuffix()}`);
    const targy = `Beázás ${uniqueSuffix()}`;
    await page.goto("/jegyek");
    await expect(page.getByRole("heading", { name: "Ügyfélszolgálati jegyek" })).toBeVisible();
    await page.getByRole("button", { name: "Új jegy" }).click();
    await page.getByLabel("Ügyfél", { exact: true }).selectOption(String(ugyfel.id));
    await page.getByLabel("Tárgy").fill(targy);
    await page.getByRole("button", { name: "Jegy rögzítése" }).click();
    await expect(page.getByText(targy)).toBeVisible();

    await page.getByLabel(`${targy} állapota`).selectOption("megoldva");
    // a "Csak nyitottak" szűrő alapból be van kapcsolva, ezért a megoldott jegy eltűnik a listából
    await expect(page.getByText(targy)).toHaveCount(0);
    await page.getByLabel("Csak nyitottak").uncheck();
    await expect(page.getByLabel(`${targy} állapota`)).toHaveValue("megoldva");
  });

  test("Kampányok: címke (szegmens) létrehozása és törlése", async ({ page }) => {
    const cimke = `Szegmens ${uniqueSuffix()}`;
    await page.goto("/kampanyok");
    await expect(page.getByRole("heading", { name: "Szegmensek és kampányok" })).toBeVisible();
    await page.getByLabel("Új címke").fill(cimke);
    await page.getByRole("button", { name: "Létrehoz" }).click();
    const sor = page.getByRole("listitem").filter({ hasText: cimke });
    await expect(sor).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await sor.getByRole("button", { name: "Törlés" }).click();
    await expect(sor).toHaveCount(0);
  });

  test("Előrejelzés: táblázat és havi cél mentése", async ({ page }) => {
    await page.goto("/elorejelzes");
    await expect(page.getByRole("heading", { name: "Értékesítési előrejelzés" })).toBeVisible();
    const cel = page.getByRole("textbox", { name: /cél$/ }).or(page.getByRole("spinbutton", { name: /cél$/ })).first();
    await expect(cel).toBeVisible();
    const ertek = String(1000000 + (Date.now() % 900000));
    await cel.fill(ertek);
    await expect(page.getByRole("button", { name: "Mentés" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Mentés" }).first().click();
    await page.reload();
    await expect(cel).toHaveValue(ertek);
    await shot(page, "elorejelzes");
  });

  test("Auditnapló: bejegyzések és szűrés (admin)", async ({ page, request }) => {
    await ujUgyfel(request, `E2E Audit ${uniqueSuffix()}`);
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: "Auditnapló" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Művelet" })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.getByLabel("Típus szűrő").selectOption({ index: 1 });
    await expect(page.locator("tbody")).toBeVisible();
  });

  test("Értesítések: a harang megnyílik", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Értesítések/ }).click();
    await expect(page.getByText(/Nincs teendő|határidő|lejár|késik/i).first()).toBeVisible();
  });

  test("Ügyfél: címke és egyedi mező", async ({ page, request }) => {
    const ugyfel = await ujUgyfel(request, `E2E Címkés ${uniqueSuffix()}`);
    const cimke = `VIP ${uniqueSuffix()}`;
    const mezo = `Mező ${uniqueSuffix()}`;
    await page.goto(`/ugyfelek/${ugyfel.id}`);

    await page.getByPlaceholder("Új címke").fill(cimke);
    await page.getByRole("button", { name: "Létrehoz" }).click();
    await expect(page.getByRole("button", { name: `${cimke} címke eltávolítása` })).toBeVisible();

    await page.getByPlaceholder("Új mező neve").fill(mezo);
    await page.getByRole("button", { name: "Mező felvétele" }).click();
    await expect(page.getByText(mezo)).toBeVisible();
    await shot(page, "ugyfel-cimke-egyedi-mezo");
  });
});
