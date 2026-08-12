import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("admin can log in and reach the dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: /Üdvözlünk/ })).toBeVisible();
});
