import { test, expect } from "@playwright/test";

test.describe("Projektek: lista / kártyák / térkép", () => {
  test("A nézetváltó átkapcsol és megjegyzi a választást", async ({ page }) => {
    await page.goto("/projektek");
    await page.getByRole("button", { name: "Kártyák" }).click();
    await expect(page.getByTestId("projekt-kartyak")).toBeVisible();

    await page.getByRole("button", { name: "Térkép" }).click();
    await expect(page.getByTestId("projekt-terkep")).toBeVisible();
    await expect(page.getByTestId("projekt-kartyak")).toHaveCount(0);

    // újratöltés után a térkép marad
    await page.reload();
    await expect(page.getByTestId("projekt-terkep")).toBeVisible();

    await page.getByRole("button", { name: "Lista" }).click();
    await expect(page.getByTestId("projekt-terkep")).toHaveCount(0);
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("A kereső szűri a kártyákat", async ({ page }) => {
    await page.goto("/projektek");
    await page.getByRole("button", { name: "Kártyák" }).click();
    await page.getByRole("searchbox").fill("zzz-nincs-ilyen-projekt");
    await expect(page.getByText("Nincs a keresésnek megfelelő projekt.")).toBeVisible();
    await page.getByRole("searchbox").fill("");
    await page.getByRole("button", { name: "Lista" }).click();
  });
});
