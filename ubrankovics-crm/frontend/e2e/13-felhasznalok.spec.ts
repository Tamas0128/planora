import { test, expect } from "@playwright/test";
import { login, shot, uniqueSuffix } from "./helpers";

test.describe("Felhasználók (admin) és RBAC", () => {
  test("lista betöltődik, szerepkör váltható egy eldobható teszt-felhasználón", async ({ page }) => {
    // Szándékosan NEM a bejelentkezett admin saját sorát módosítjuk itt —
    // korábban ez pontosan ezt a tesztet futtatva önmagát zárta ki
    // ("vezetes" szerepkörre váltott, majd a visszaállítás soha nem futott le,
    // mert egy korábbi lépés eldobta a tesztet), ami az admin fiókot
    // ideiglenesen kizárta minden admin-only felületről. Helyette egy saját,
    // eldobható felhasználót hozunk létre, és AZON teszteljük a váltást.
    const username = `e2eroletest${uniqueSuffix()}`;
    await page.goto("/felhasznalok");
    await expect(page.getByRole("heading", { name: "Felhasználók" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await shot(page, "felhasznalok-lista");

    await page.getByRole("button", { name: "Új felhasználó" }).click();
    await page.getByPlaceholder("Felhasználónév").fill(username);
    await page.getByPlaceholder("Teljes név").fill("E2E Szerepkör Teszt");
    await page.getByPlaceholder("E-mail").fill(`${username}@example.com`);
    await page.getByPlaceholder("Jelszó").fill("TesztJelszo123!");
    await page.locator("form select").selectOption("ertekesites");
    await page.getByRole("button", { name: "Létrehozás" }).click();

    const row = page.locator("tr", { hasText: username });
    await expect(row).toBeVisible();
    const roleSelect = row.locator("select");
    await expect(roleSelect).toHaveValue("ertekesites");

    await roleSelect.selectOption("penzugy");
    await expect(roleSelect).toHaveValue("penzugy");
  });

  test("új korlátozott jogú felhasználó nem éri el a Felhasználók felületet (RBAC)", async ({ page, browser }) => {
    const username = `e2euser${uniqueSuffix()}`;
    const password = "TesztJelszo123!";

    await page.goto("/felhasznalok");
    await page.getByRole("button", { name: "Új felhasználó" }).click();
    await page.getByPlaceholder("Felhasználónév").fill(username);
    await page.getByPlaceholder("Teljes név").fill("E2E Kivitelező");
    await page.getByPlaceholder("E-mail").fill(`${username}@example.com`);
    await page.getByPlaceholder("Jelszó").fill(password);
    await page.locator("form select").selectOption("kivitelezes");
    await page.getByRole("button", { name: "Létrehozás" }).click();
    await expect(page.locator(`text=${username}`).first()).toBeVisible();
    await shot(page, "felhasznalok-uj-korlatozott-user");

    // Külön, saját bejelentkezési állapotú kontextusban lépünk be ezzel a felhasználóval,
    // hogy ne írjuk felül az admin storageState-et a többi teszthez.
    const context = await browser.newContext();
    const limitedPage = await context.newPage();
    await login(limitedPage, username, password);

    await expect(limitedPage.getByRole("link", { name: "Felhasználók" })).toHaveCount(0);
    await limitedPage.goto("/felhasznalok");
    await expect(limitedPage.getByText("Nincs jogosultságod ehhez a felülethez.")).toBeVisible();
    await shot(limitedPage, "rbac-korlatozott-user-elutasitva");

    await context.close();
  });
});
