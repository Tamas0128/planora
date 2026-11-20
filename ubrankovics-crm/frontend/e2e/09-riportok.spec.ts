import { test, expect } from "@playwright/test";
import { shot } from "./helpers";

test.describe("Riportok", () => {
  test("értékesítési állapot és pénzügyi összesítő megjelenik", async ({ page }) => {
    await page.goto("/riportok");
    await expect(page.getByRole("heading", { name: "Riportok" })).toBeVisible();
    await expect(page.getByText("Értékesítési állapot")).toBeVisible();
    await expect(page.getByText("Pénzügyi összesítő")).toBeVisible();
    await expect(page.getByText("Ajánlat", { exact: true })).toBeVisible();
    await expect(page.getByText("Lejárt bevétel (hátralék)")).toBeVisible();
    await shot(page, "riportok-teljes-oldal");
  });
});
