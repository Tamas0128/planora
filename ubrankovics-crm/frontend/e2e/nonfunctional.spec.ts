import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { shot } from "./helpers";

const PAGES_FOR_A11Y = ["/", "/ugyfelek", "/projektek", "/feladatok", "/penzugy", "/riportok", "/torzsadatok"];

test.describe("Akadálymentesség (axe-core)", () => {
  for (const path of PAGES_FOR_A11Y) {
    test(`axe scan: ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      // eslint-disable-next-line no-console
      if (results.violations.length) {
        console.log(
          `[a11y] ${path}: ${results.violations.length} violation(s) — ${results.violations
            .map((v) => `${v.id}(${v.impact})`)
            .join(", ")}`
        );
      }
      expect(serious, `Komoly (serious/critical) a11y hiba a(z) ${path} oldalon`).toEqual([]);
    });
  }
});

test.describe("Reszponzivitás (mobil nézet)", () => {
  for (const path of ["/", "/ugyfelek", "/projektek", "/penzugy", "/feladatok"]) {
    test(`nincs vízszintes túlcsordulás mobilon: ${path}`, async ({ page }) => {
      await page.goto(path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${path}: scrollWidth (${scrollWidth}) > clientWidth (${clientWidth}) — vízszintes túlcsordulás`).toBeLessThanOrEqual(
        clientWidth + 1
      );
    });
  }

  test("képernyőkép mobil nézetről (Kezdőlap)", async ({ page }) => {
    await page.goto("/");
    await shot(page, "mobil-kezdolap");
  });
});

test.describe("Teljesítmény (puha küszöbök)", () => {
  for (const path of ["/", "/projektek", "/penzugy"]) {
    test(`oldalbetöltés ésszerű időn belül: ${path}`, async ({ page }) => {
      const start = Date.now();
      await page.goto(path, { waitUntil: "networkidle" });
      const elapsed = Date.now() - start;
      // eslint-disable-next-line no-console
      console.log(`[perf] ${path}: ${elapsed}ms (networkidle)`);
      expect(elapsed, `${path} betöltése ${elapsed}ms — ez egy dev-build helyi szerveren, nagyvonalú küszöb`).toBeLessThan(8_000);
    });
  }
});

test.describe("Hibakezelés", () => {
  test("nem létező projekt id-re navigálva nem omlik össze az alkalmazás", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/projektek/999999");
    await expect(page.locator("text=/Betöltés|Hiba|not found|404/i").first()).toBeVisible({ timeout: 10_000 });
    await shot(page, "hibakezeles-nemletezo-projekt");
    expect(pageErrors, `Kliens oldali kivétel: ${pageErrors.join("; ")}`).toEqual([]);
  });

  test("nem létező útvonal nem omlik össze (Next.js 404)", async ({ page }) => {
    const resp = await page.goto("/ez-nem-letezik-sehol");
    expect(resp?.status()).toBe(404);
    await shot(page, "hibakezeles-404-route");
  });
});
