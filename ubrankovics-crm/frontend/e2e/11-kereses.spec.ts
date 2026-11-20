import { test, expect } from "@playwright/test";
import { shot, uniqueSuffix } from "./helpers";

test.describe("Ctrl+K globális keresés", () => {
  test("Ctrl+K megnyitja az ablakot, keresés és navigáció", async ({ page }) => {
    const nev = `E2EKereses${uniqueSuffix()}`;
    await page.goto("/ugyfelek");
    await page.getByRole("button", { name: "Új ügyfél" }).click();
    await page.getByPlaceholder("Név").fill(nev);
    await page.getByRole("button", { name: "Mentés" }).click();
    await expect(page.locator(`text=${nev}`)).toBeVisible();

    await page.keyboard.press("Control+k");
    const searchBox = page.getByPlaceholder(/Keresés ügyfél/);
    await expect(searchBox).toBeVisible();
    await shot(page, "kereses-ablak-megnyitva");

    await searchBox.fill(nev);
    // A találat gombként jelenik meg a keresőablakban — az ügyfelek lista mögötte lévő
    // sorát (link, nem gomb) külön kell kizárni, hogy ne fusson le túl korán az Enter.
    await expect(page.getByRole("button", { name: nev })).toBeVisible({ timeout: 5_000 });
    await shot(page, "kereses-talalat");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ugyfelek\/\d+/);
    await expect(page.getByRole("heading", { name: nev })).toBeVisible();
  });

  test("Escape bezárja az ablakot", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/Keresés ügyfél/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder(/Keresés ügyfél/)).toHaveCount(0);
  });

  test("nincs találat esetén üzenet jelenik meg", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Keresés ügyfél/).fill("zzznincsilyenzzz");
    await expect(page.getByText("Nincs találat.")).toBeVisible();
  });
});
