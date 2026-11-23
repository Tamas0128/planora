import { test, expect, Page, APIRequestContext } from "@playwright/test";
import path from "path";
import { ADMIN_PASSWORD, ADMIN_USER } from "./helpers";

// A felhasználói kézikönyv képernyőképeit készíti a demo-adatokból (backend/scripts/demo_adatok.py).
// Csak kérésre fut:  SCREENSHOTS=1 npx playwright test e2e/kepernyokepek.spec.ts --project=chromium-desktop
const KEP_DIR = path.resolve(__dirname, "../../docs/felhasznaloi-kezikonyv/kepek");

test.skip(!process.env.SCREENSHOTS, "Csak SCREENSHOTS=1 mellett fut");
test.describe.configure({ mode: "serial" });

async function api(request: APIRequestContext) {
  const r = await request.post("/api/auth/login/json", { data: { username: ADMIN_USER, password: ADMIN_PASSWORD } });
  const { access_token } = await r.json();
  return { Authorization: `Bearer ${access_token}` };
}

async function shot(page: Page, nev: string, opts: { full?: boolean } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1900); // animációk lefutnak
  await page.screenshot({ path: path.join(KEP_DIR, `${nev}.png`), fullPage: opts.full ?? false });
}

test("Képernyőképek", async ({ page, request, browser }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const headers = await api(request);
  const projektek: { id: number; projekt_nev: string }[] = await (await request.get("/api/projektek", { headers })).json();
  const pid = (reszlet: string) => projektek.find((p) => p.projekt_nev.includes(reszlet))!.id;
  const KOVACS = pid("Kovács–Neményi");
  const DUNA = pid("Dunakanyar");
  const HORVATH = pid("Horváth");
  const TOTH = pid("Tóth");
  const ugyfelek: { id: number; nev: string }[] = await (await request.get("/api/ugyfelek", { headers })).json();
  const dunaUgyfel = ugyfelek.find((u) => u.nev.includes("Dunakanyar"))!.id;

  // 1. Belépés (kijelentkezve)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lp = await ctx.newPage();
  await lp.goto("/login");
  await lp.waitForTimeout(800);
  await lp.screenshot({ path: path.join(KEP_DIR, "01-belepes.png") });
  await ctx.close();

  // 2. Kezdőlap
  await page.goto("/");
  await shot(page, "02-kezdolap");

  // 3–5. Projektek: lista, kártyák, térkép
  await page.goto("/projektek");
  await page.getByRole("button", { name: "Lista" }).click();
  await shot(page, "03-projektek-lista");
  await page.getByRole("button", { name: "Kártyák" }).click();
  await shot(page, "04-projektek-kartyak");
  await page.getByRole("button", { name: "Térkép" }).click();
  await page.waitForSelector(".leaflet-marker-icon");
  await page.waitForTimeout(2500);
  await shot(page, "05-projektek-terkep");
  await page.getByRole("button", { name: "Lista" }).click(); // alapértelmezett nézet vissza

  // 6–12. Projekt (Dunakanyar): áttekintés, tételek, ütemezés, ajánlat, napló, átadás, dokumentumok
  await page.goto(`/projektek/${DUNA}`);
  await shot(page, "06-projekt-attekintes");
  await page.getByRole("button", { name: "Tételek", exact: true }).click();
  await shot(page, "07-projekt-tetelek");
  const utemezes = page.getByRole("button", { name: "Ütemezés", exact: true });
  if (await utemezes.count()) {
    await utemezes.click();
    await shot(page, "08-projekt-utemezes");
  }
  await page.getByRole("button", { name: "Építési napló" }).click();
  await shot(page, "10-projekt-naplo");
  await page.getByRole("button", { name: "Dokumentumok" }).click();
  await shot(page, "12-projekt-dokumentumok");

  await page.goto(`/projektek/${HORVATH}`);
  await page.getByRole("button", { name: "Ajánlat", exact: true }).click();
  await shot(page, "09-projekt-ajanlat");

  await page.goto(`/projektek/${TOTH}`);
  await page.getByRole("button", { name: "Átadás", exact: true }).click();
  await shot(page, "11-projekt-atadas");

  // 13–16. Pénzügy
  await page.goto("/penzugy");
  await page.getByRole("button", { name: "Következő 26 hét" }).click();
  await shot(page, "13-penzugy-cashflow", { full: true });
  await page.getByRole("button", { name: "Szerződések" }).click();
  await page.locator("select").first().selectOption({ label: projektek.find((p) => p.id === DUNA)!.projekt_nev });
  await shot(page, "14-penzugy-szerzodesek");
  await page.getByRole("button", { name: /TIG/ }).click();
  await page.locator("select").first().selectOption({ label: projektek.find((p) => p.id === DUNA)!.projekt_nev });
  await shot(page, "15-penzugy-tig-szamlak");

  // 17–18. Értékesítés: érdeklődők, ügyfél interakciókkal
  await page.goto("/erdeklodok");
  await shot(page, "16-erdeklodok");
  await page.goto(`/ugyfelek/${dunaUgyfel}`);
  await shot(page, "17-ugyfel-interakciok", { full: true });

  // 19–21. Feladatok, naptár, jegyek
  await page.goto("/feladatok");
  await shot(page, "18-feladatok");
  await page.goto("/naptar");
  await shot(page, "19-naptar");
  await page.goto("/jegyek");
  await shot(page, "20-jegyek");

  // 22–23. Alvállalkozók és dokumentumsablonok (törzsadatok)
  await page.goto("/torzsadatok");
  await page.getByRole("button", { name: "Alvállalkozók" }).click();
  await shot(page, "21-alvallalkozok");
  await page.getByRole("button", { name: "Dokumentumsablonok" }).click();
  await shot(page, "22-dokumentumsablonok");

  // 24–25. Riportok, előrejelzés
  await page.goto("/riportok");
  await shot(page, "23-riportok");
  await page.goto("/elorejelzes");
  await shot(page, "24-elorejelzes");

  // 26. Globális keresés
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Mecsek");
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(KEP_DIR, "25-kereses.png") });
  await page.keyboard.press("Escape");

  // 27. Mobil nézet
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/projektek/${KOVACS}`);
  await shot(page, "26-mobil-projekt");
  await page.goto("/projektek");
  await page.getByRole("button", { name: "Kártyák" }).click();
  await shot(page, "27-mobil-kartyak");
  await page.getByRole("button", { name: "Lista" }).click();
  expect(true).toBeTruthy();
});
