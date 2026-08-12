import { APIRequestContext, Page, expect } from "@playwright/test";

// Test users created for the 2026-08-12 RBAC audit (see e2e/rbac-roles.spec.ts).
// Naming convention: e2e_role_<role> — safe to identify/clean up later.
// Password is shared across all e2e_role_* accounts; admin's is read from .env
// (loaded by playwright.config.ts) same as helpers.ts::login does.
export const E2E_PASSWORD = "E2eTest1234!";

export const CREDENTIALS: Record<string, { username: string; password: string }> = {
  admin: { username: "admin", password: process.env.ADMIN_PASSWORD ?? "" },
  management: { username: "e2e_role_management", password: E2E_PASSWORD },
  project_manager: { username: "e2e_role_project_manager", password: E2E_PASSWORD },
  site_manager: { username: "e2e_role_site_manager", password: E2E_PASSWORD },
  procurement: { username: "e2e_role_procurement", password: E2E_PASSWORD },
  billing: { username: "e2e_role_billing", password: E2E_PASSWORD },
  subcontractor: { username: "e2e_role_subcontractor", password: E2E_PASSWORD },
};

// user ids assigned when the e2e_role_* accounts were created via POST /api/auth/users
export const USER_IDS: Record<string, number> = {
  admin: 1,
  project_manager: 4, // e2e_role_project_manager
  site_manager: 5, // e2e_role_site_manager
  management: 6,
  procurement: 7,
  billing: 8,
  subcontractor: 9,
};

// Pre-existing seed data (owned by seed_pm/seed_sm, ids 2/3 — passwords unknown to us)
export const SEED_OWNED_PROJECT_IDS = [1, 2, 3];
// Project created by admin for this audit, owned by e2e_role_project_manager (4) / e2e_role_site_manager (5)
export const E2E_PROJECT_ID = 6;
export const E2E_PROJECT_CODE = "LTF-006";
export const ALL_PROJECT_CODES = ["LTF-001", "LTF-002", "LTF-003", "LTF-004", "LTF-005", "LTF-006"];

// The backend rate-limits /api/auth/login to 10 attempts/60s per IP
// (auth.py::_check_login_rate). With 7 roles exercised across ~15 test cases
// we'd blow through that in seconds if every test logged in fresh — so cache
// tokens per role for the lifetime of the worker process (config runs
// workers:1/fullyParallel:false, so this module is loaded once for the whole
// spec file) and reuse them everywhere, including for "UI" logins (seed
// sessionStorage directly instead of re-submitting the login form).
type TokenPair = { access: string; refresh: string };
const tokenCache = new Map<string, TokenPair>();

async function getTokens(request: APIRequestContext, role: keyof typeof CREDENTIALS): Promise<TokenPair> {
  const cached = tokenCache.get(role);
  if (cached) return cached;
  const { username, password } = CREDENTIALS[role];
  if (!password) throw new Error(`No password configured for role ${role}`);
  const res = await request.post("/api/auth/login", {
    form: { username, password },
  });
  if (!res.ok()) {
    throw new Error(`login failed for ${role}: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const tokens = { access: body.access_token as string, refresh: body.refresh_token as string };
  tokenCache.set(role, tokens);
  return tokens;
}

/** Logs `page` in as `role` by seeding sessionStorage with a (cached) token
 * pair rather than resubmitting the login form every time — see tokenCache
 * comment above. Exercises the real login flow via `apiToken`/getTokens once
 * per role; subsequent calls just prove the app honors a stored session. */
export async function loginAs(page: Page, role: keyof typeof CREDENTIALS) {
  const tokens = await getTokens(page.request, role);
  await page.goto("/login");
  await page.evaluate(
    ({ access, refresh }) => {
      sessionStorage.setItem("planora_token", access);
      sessionStorage.setItem("planora_refresh_token", refresh);
    },
    { access: tokens.access, refresh: tokens.refresh },
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

/** One real UI form login — used by a single smoke test to prove the actual
 * login form works end to end (everything else uses loginAs' cached-token shortcut). */
export async function loginViaForm(page: Page, role: keyof typeof CREDENTIALS) {
  const { username, password } = CREDENTIALS[role];
  await page.goto("/login");
  await page.getByLabel("Felhasználónév").fill(username);
  await page.getByLabel("Jelszó").fill(password);
  await page.getByRole("button", { name: "Bejelentkezés" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

/** Direct API login (bypasses the UI) — returns a bearer token for raw
 * backend-level 403/200 spot checks via the `request` fixture. Cached, see above. */
export async function apiToken(request: APIRequestContext, role: keyof typeof CREDENTIALS): Promise<string> {
  const tokens = await getTokens(request, role);
  return tokens.access;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
