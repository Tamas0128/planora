import { test, expect } from "@playwright/test";
import { shot } from "./helpers";

test.describe("Dashboard / Kezdőlap", () => {
  test("widgetek megjelennek, linkek működnek", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Kezdőlap/ })).toBeVisible();
    await expect(page.getByText("Projektek összesen")).toBeVisible();
    await expect(page.getByText("Projektek állapot szerint")).toBeVisible();
    await expect(page.getByText("Közelgő saját feladatok")).toBeVisible();
    await shot(page, "dashboard-fooldal");

    await page.getByRole("link", { name: "Teljes riportok →" }).click();
    await expect(page).toHaveURL(/\/riportok/);
  });

  test("Főmenü: a Kezdőlap nem terület, a projekt oldalakon a Projektek aktív", async ({ page }) => {
    await page.goto("/");
    const fomenu = page.getByRole("navigation", { name: "Főmenü" });
    await expect(fomenu.locator("[aria-current=page]")).toHaveCount(0);

    await page.goto("/projektek");
    await expect(fomenu.getByRole("link", { name: "Projektek" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Kezdőlap" })).not.toHaveAttribute("aria-current", "page");
  });
});
