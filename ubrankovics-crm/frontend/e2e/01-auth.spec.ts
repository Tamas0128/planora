import { test, expect } from "@playwright/test";
import { login, logout, shot, ADMIN_PASSWORD } from "./helpers";

test.describe("Hitelesítés", () => {
  test("sikeres bejelentkezés a Kezdőlapra navigál", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /Kezdőlap/ })).toBeVisible();
    await shot(page, "login-success-dashboard");
  });

  test("hibás jelszóval bejelentkezési hibaüzenet jelenik meg", async ({ page }) => {
    await page.goto("/login");
    const inputs = page.locator("form input");
    await inputs.nth(0).fill("admin");
    await inputs.nth(1).fill("rossz-jelszo-xyz");
    await page.getByRole("button", { name: "Bejelentkezés" }).click();
    await expect(page.locator("text=/sikertelen|Hiba|Invalid credentials|Hibás felhasználónév/i")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
    await shot(page, "login-failure-error");
  });

  test("be nem jelentkezett felhasználó a védett oldalakról /login-ra kerül", async ({ page }) => {
    await page.goto("/projektek");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/penzugy");
    await expect(page).toHaveURL(/\/login/);
  });

  test("kijelentkezés után /login-ra kerül, és a védett oldal újra elérhetetlen", async ({ page }) => {
    await login(page);
    await logout(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sikeres bejelentkezés után a token megmarad lapfrissítés után is", async ({ page }) => {
    await login(page);
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("Jelszó-erősség / adatvédelem (nem-funkcionális)", () => {
  test("a jelszó mező type=password, nem jelenik meg plain textként", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.locator("form input").nth(1);
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("admin jelszó nem szivárog a kliens oldali localStorage-ba", async ({ page }) => {
    await login(page);
    const storage = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storage).not.toContain(ADMIN_PASSWORD);
  });
});
