import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("CRM: create customer, quote it, accept, and turn it into a contract", async ({ page }) => {
  await login(page);

  await page.goto("/crm/customers");
  await page.getByRole("button", { name: "Új ügyfél" }).click();

  const customerName = `E2E Teszt Ügyfél ${Date.now()}`;
  // Default customer type is "person" — no phone/email/tax fields to fill.
  await page.getByLabel("Név").fill(customerName);
  // Admin/management must pick an owner (backend: owner_id kötelező for those roles).
  // Combobox order in the dialog: Ügyfél típusa, Felelős ügyintéző, Forrás.
  await page.getByRole("dialog").getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Létrehozás" }).click();

  await page.getByRole("link", { name: customerName }).click();
  await expect(page).toHaveURL(/\/crm\/customers\/\d+/);

  await page.getByRole("tab", { name: "Ajánlatok" }).click();
  await page.getByRole("button", { name: "Új ajánlat" }).click();
  await page.getByLabel("Ajánlat értéke (Ft)").fill("5000000");
  await page.getByRole("button", { name: "Létrehozás" }).click();

  // Move the quote straight to "accepted" via its row-level status select.
  const quoteRow = page
    .locator("div.flex.items-center.justify-between.gap-2.p-3.text-sm")
    .filter({ hasText: /^AJ-/ });
  await quoteRow.getByRole("combobox").click();
  await page.getByRole("option", { name: "Elfogadva" }).click();

  await page.getByRole("button", { name: "Szerződés létrehozása" }).click();
  const today = new Date().toISOString().split("T")[0];
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
  await page.getByLabel("Kezdő dátum").fill(today);
  await page.getByLabel("Lejárati dátum").fill(nextYear);
  await page.getByRole("button", { name: "Szerződés létrehozása" }).click();

  await page.getByRole("tab", { name: "Szerződések" }).click();
  await expect(page.getByText(/^SZ-/)).toBeVisible();
});
