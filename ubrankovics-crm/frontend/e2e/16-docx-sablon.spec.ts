import { test, expect, APIRequestContext } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_USER, uniqueSuffix } from "./helpers";
import { miniDocx } from "./fixtures/mini-docx";

let cachedAuth: { Authorization: string } | null = null;
async function auth(request: APIRequestContext) {
  if (cachedAuth) return cachedAuth;
  const r = await request.post("/api/auth/login/json", { data: { username: ADMIN_USER, password: ADMIN_PASSWORD } });
  const { access_token } = await r.json();
  cachedAuth = { Authorization: `Bearer ${access_token}` };
  return cachedAuth;
}

test.describe("Feltölthető .docx sablon", () => {
  test("Feltöltés a Törzsadatokban, majd generálás a projekten", async ({ page, request }) => {
    const headers = await auth(request);
    const u = await (await request.post("/api/ugyfelek", { data: { nev: `E2E Docx ${uniqueSuffix()}` }, headers })).json();
    const nev = `E2E Docx projekt ${uniqueSuffix()}`;
    const p = await (
      await request.post("/api/projektek", { data: { projekt_nev: nev, ugyfelek: [{ ugyfel_id: u.id }] }, headers })
    ).json();

    await page.goto("/torzsadatok");
    await page.getByRole("button", { name: "Dokumentumsablonok" }).click();
    await expect(page.getByTestId("sablon-lista")).toBeVisible();

    await page.getByLabel("Szerződés sablon feltöltése").setInputFiles({
      name: "szerzodes-sablon.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: miniDocx("Projekt: {{ projekt_nev }}"),
    });
    await expect(page.getByTestId("sablon-szerzodes").getByText(/szerzodes-sablon\.docx/)).toBeVisible();

    // hibás sablon: a feltöltés elutasítva
    await page.getByLabel("Ajánlat sablon feltöltése").setInputFiles({
      name: "hibas.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: miniDocx("{% for x in %}"),
    });
    await expect(page.getByText(/A sablon nem tölthető ki/)).toBeVisible();

    // generálás a projekt oldalán
    await page.goto(`/projektek/${p.id}`);
    await page.getByRole("button", { name: "Tételek", exact: true }).click();
    const select = page.locator("select").filter({ has: page.locator('option[value="szerzodes"]') }).first();
    await select.selectOption("szerzodes");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "DOCX generálása" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^szerzodes-.*\.docx$/);

    // sablon nélküli típus: érthető hibaüzenet
    await select.selectOption("tig");
    await page.getByRole("button", { name: "DOCX generálása" }).click();
    await expect(page.getByText(/nincs feltöltött \.docx sablon/)).toBeVisible();

    // takarítás
    await request.delete("/api/sablonfajlok/szerzodes", { headers });
  });
});
