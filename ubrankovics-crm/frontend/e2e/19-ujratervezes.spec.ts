import { test, expect, APIRequestContext } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_USER, uniqueSuffix } from "./helpers";

let cachedAuth: { Authorization: string } | null = null;

// Egyszer lépünk be API-n át, hogy ne fussunk a belépési rate limitbe.
async function auth(request: APIRequestContext) {
  if (cachedAuth) return cachedAuth;
  const r = await request.post("/api/auth/login/json", { data: { username: ADMIN_USER, password: ADMIN_PASSWORD } });
  const { access_token } = await r.json();
  cachedAuth = { Authorization: `Bearer ${access_token}` };
  return cachedAuth;
}

test.describe("Újratervezett felület: morzsamenü, Ütemterv, Törzsadat › Ütemezés, Pénz fülek", () => {
  test("Ütemterv menüpont: oldal és szűrő", async ({ page }) => {
    await page.goto("/projektek");
    await page.getByRole("link", { name: "Ütemterv" }).click();
    await expect(page).toHaveURL(/\/utemterv$/);
    await expect(page.getByRole("navigation", { name: "Morzsamenü" })).toContainText("Ütemterv");
    await page.getByRole("button", { name: "Csak a késők" }).click();
    await expect(page.getByRole("button", { name: "Csak a késők" })).toHaveAttribute("aria-pressed", "true");
  });

  test("Törzsadatok › Ütemezés: átfutási idő módosítható", async ({ page }) => {
    await page.goto("/torzsadatok?tab=utemezes");
    const mezo = page.getByLabel(/átfutás napokban/).first();
    await expect(mezo).toBeVisible();
    const jelenlegi = Number(await mezo.inputValue());
    await mezo.fill(String(jelenlegi + 1));
    await mezo.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "mentve" })).toBeVisible();
  });

  test("Projekt: fázis szerinti fülek, Bevétel/Kiadás fül és morzsamenü", async ({ page, request }) => {
    const headers = await auth(request);
    const p = await (await request.post("/api/projektek", { data: { projekt_nev: `E2E Pénz ${uniqueSuffix()}` }, headers })).json();
    await page.goto(`/projektek/${p.id}`);
    for (const f of ["Szerződés", "Tételek", "Partnerek", "Bevétel", "Kiadás"]) {
      await expect(page.getByRole("button", { name: f, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Bevétel", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Morzsamenü" })).toContainText("Bevétel");
    await page.getByRole("link", { name: "Teljes cash flow erre a projektre" }).click();
    await expect(page).toHaveURL(`/penzugy?projekt=${p.id}`);
    await expect(page.getByRole("navigation", { name: "Morzsamenü" })).toContainText("Teljes cash flow");
  });

  test("Partnerek fül: partner felvétele és szerkesztése", async ({ page, request }) => {
    const headers = await auth(request);
    const p = await (await request.post("/api/projektek", { data: { projekt_nev: `E2E Partner ${uniqueSuffix()}` }, headers })).json();
    await page.goto(`/projektek/${p.id}`);
    await page.getByRole("button", { name: "Partnerek", exact: true }).click();
    const nev = `E2E Kivitelező ${uniqueSuffix()}`;
    await page.getByLabel("Partner neve").first().fill(nev);
    await page.getByLabel("Kapcsolattartó, telefon").fill("Kiss Pál +36 1");
    await page.getByRole("button", { name: "Partner felvétele" }).click();
    const sor = page.getByRole("listitem").filter({ hasText: nev });
    await expect(sor).toContainText("Kiss Pál");
    await sor.getByRole("button", { name: "Szerkesztés" }).click();
    await page.getByLabel("Kapcsolat", { exact: true }).fill("Nagy Béla");
    await page.getByRole("button", { name: "Mentés" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: nev })).toContainText("Nagy Béla");
  });
});
