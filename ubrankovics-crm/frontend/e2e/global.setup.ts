import { test as setup } from "@playwright/test";
import { login } from "./helpers";

const STORAGE_STATE = "e2e/.auth/admin.json";

setup("admin bejelentkezés egyszer, a többi teszt ezt az állapotot használja újra", async ({ page }) => {
  await login(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
