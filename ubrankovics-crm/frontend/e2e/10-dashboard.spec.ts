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

  test("Kezdőlap nav-elem csak a gyökéroldalon aktív", async ({ page }) => {
    await page.goto("/");
    const kezdolapLink = page.getByRole("link", { name: "Kezdőlap" });
    await expect(kezdolapLink).toHaveClass(/sidebar-active|font-medium/);

    await page.goto("/projektek");
    await expect(kezdolapLink).not.toHaveClass(/sidebar-active/);
  });
});
