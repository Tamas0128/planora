import { test, expect } from "@playwright/test";
import {
  CREDENTIALS,
  USER_IDS,
  SEED_OWNED_PROJECT_IDS,
  E2E_PROJECT,
  E2E_PARTNER,
  ALL_PROJECT_CODES,
  ensureE2eFixtures,
  loginAs,
  loginViaForm,
  apiToken,
  authHeader,
} from "./rbac-helpers";

// Finds-or-creates the E2E project/partner this file depends on and
// refreshes ALL_PROJECT_CODES from live data before anything else runs —
// see the comment on E2E_PROJECT in rbac-helpers.ts for why this can't be
// a hardcoded id/code anymore.
test.beforeAll(async ({ request }) => {
  await ensureE2eFixtures(request);
});

// Real end-to-end login form smoke test for one representative non-admin role
// (every other test uses loginAs' cached-token shortcut to stay under the
// backend's 10-attempts/60s login rate limit — see rbac-helpers.ts).
test("real login form works end-to-end for a non-admin role (site_manager)", async ({ page }) => {
  await loginViaForm(page, "site_manager");
  await expect(page.getByRole("heading", { name: "Üdvözlünk, E2E site_manager!" })).toBeVisible();
});

type Role = keyof typeof CREDENTIALS;
const ALL_ROLES: Role[] = [
  "admin",
  "management",
  "project_manager",
  "site_manager",
  "procurement",
  "billing",
  "subcontractor",
];

// ---------------------------------------------------------------------------
// 1. Sidebar nav visibility — mirrors AppLayout.tsx's NAV_CRM/NAV_FINANCE/NAV_ADMIN role lists.
// ---------------------------------------------------------------------------
const EXPECTED_NAV: Record<Role, string[]> = {
  admin: [
    "Dashboard", "Projektek", "Feladatok", "Naptár", "Saját feladatok", "Előkészítés",
    "Ügyfelek (CRM)", "Értékesítési dashboard",
    "Pénzügy",
    "Felhasználók", "Audit napló", "Ütemterv sablon", "Dokumentumsablonok", "Cégadatok", "Alvállalkozói törzs",
  ],
  management: [
    "Dashboard", "Projektek", "Feladatok", "Naptár", "Saját feladatok", "Előkészítés",
    "Ügyfelek (CRM)", "Értékesítési dashboard",
    "Pénzügy",
    "Audit napló", "Ütemterv sablon", "Cégadatok", "Alvállalkozói törzs",
  ],
  project_manager: [
    "Dashboard", "Projektek", "Feladatok", "Naptár", "Saját feladatok", "Előkészítés",
    "Ügyfelek (CRM)", "Értékesítési dashboard",
    "Pénzügy",
  ],
  site_manager: [
    "Dashboard", "Projektek", "Feladatok", "Naptár", "Saját feladatok", "Előkészítés",
    "Ügyfelek (CRM)", "Értékesítési dashboard",
  ],
  procurement: [
    "Dashboard", "Projektek", "Feladatok", "Naptár", "Saját feladatok", "Előkészítés",
  ],
  billing: [
    "Dashboard", "Projektek", "Feladatok", "Naptár", "Saját feladatok", "Előkészítés",
    "Ügyfelek (CRM)", "Értékesítési dashboard",
    "Pénzügy", "Cégadatok", "Alvállalkozói törzs",
  ],
  subcontractor: [
    "Dashboard", "Projektek", "Feladatok", "Naptár", "Saját feladatok", "Előkészítés",
  ],
};

const NAV_ITEMS_RESTRICTED_SET = ["Felhasználók", "Audit napló", "Ütemterv sablon", "Dokumentumsablonok", "Cégadatok", "Alvállalkozói törzs"];

for (const role of ALL_ROLES) {
  test(`nav visibility — ${role}`, async ({ page }) => {
    await loginAs(page, role);
    const sidebar = page.locator("aside, [data-slot='sidebar']").first();
    for (const label of EXPECTED_NAV[role]) {
      await expect(page.getByRole("link", { name: label, exact: true }), `${role} should see "${label}"`).toBeVisible();
    }
    const shouldNotSee = NAV_ITEMS_RESTRICTED_SET.filter((l) => !EXPECTED_NAV[role].includes(l));
    for (const label of shouldNotSee) {
      await expect(page.getByRole("link", { name: label, exact: true }), `${role} should NOT see "${label}"`).toHaveCount(0);
    }
    void sidebar;
  });
}

// ---------------------------------------------------------------------------
// 2. Project list scope — GET /projects: only PROJECT_MANAGER/SITE_MANAGER filtered.
// ---------------------------------------------------------------------------
// A function, not a static object — ALL_PROJECT_CODES/E2E_PROJECT.code are
// only populated once beforeAll's ensureE2eFixtures() has run, so this must
// be evaluated per-test (after that), not captured into array literals at
// module-load time (which would freeze them at their still-empty initial values).
function getExpectedProjectCodes(role: Role): string[] {
  switch (role) {
    case "admin":
    case "management":
    case "procurement":
    case "billing":
      return ALL_PROJECT_CODES;
    case "project_manager":
    case "site_manager":
      return [E2E_PROJECT.code];
    // Fixed 2026-08-12: subcontractor used to see every project, unscoped —
    // now scoped to projects with at least one activity assigned to their
    // role, same as scoped_activity_query already did for prep-center/my-tasks.
    // None of the seed/E2E projects have a subcontractor-assigned activity by
    // default, so the list is empty here — see the dedicated scoping test below.
    case "subcontractor":
      return [];
  }
}

for (const role of ALL_ROLES) {
  test(`project list scope — ${role}`, async ({ page }) => {
    await loginAs(page, role);
    await page.goto("/projects");
    // default view is "kanban" (project_code is not rendered there) — switch to
    // "Lista" where each row shows project_code as visible text (page.tsx:425).
    await page.getByRole("button", { name: "Lista" }).click();
    const expected = getExpectedProjectCodes(role);
    for (const code of expected) {
      await expect(page.getByText(code, { exact: true }), `${role} should see project ${code}`).toBeVisible();
    }
    const unexpected = ALL_PROJECT_CODES.filter((c) => !expected.includes(c));
    for (const code of unexpected) {
      await expect(page.getByText(code, { exact: true }), `${role} should NOT see project ${code}`).toHaveCount(0);
    }
  });
}

// ---------------------------------------------------------------------------
// 3. Project edit rights — own vs. another PM/SM's project.
// ---------------------------------------------------------------------------
test("project_manager can open and see edit controls on own project", async ({ page }) => {
  await loginAs(page, "project_manager");
  await page.goto(`/projects/${E2E_PROJECT.id}`);
  await expect(page.getByRole("heading", { name: "E2E RBAC Test Projekt" })).toBeVisible();
  await expect(page.getByText("Betöltés...")).toHaveCount(0);
});

test("project_manager CANNOT open another PM's project (seed_pm's project 1)", async ({ page, request }) => {
  await loginAs(page, "project_manager");
  // Direct API check (precise, no risk of a network-sniffing predicate matching
  // one of the several OTHER /api/projects/1/* requests the detail page fires
  // in parallel — activities/documents/photos/finance/audit-log all share that
  // URL prefix) — confirms the backend itself rejects this, independent of the UI.
  const token = await apiToken(request, "project_manager");
  const apiRes = await request.get("/api/projects/1", { headers: authHeader(token) });
  expect(apiRes.status(), "GET /api/projects/1 should 403 for a non-owning PM").toBe(403);

  await page.goto("/projects/1");
  // page should be stuck on the loading state since `project` never populates
  await expect(page.getByText("Betöltés...")).toBeVisible();
});

test("site_manager can open own project and CANNOT open another SM's project", async ({ page, request }) => {
  await loginAs(page, "site_manager");
  await page.goto(`/projects/${E2E_PROJECT.id}`);
  await expect(page.getByRole("heading", { name: "E2E RBAC Test Projekt" })).toBeVisible();

  const token = await apiToken(request, "site_manager");
  const apiRes = await request.get("/api/projects/1", { headers: authHeader(token) });
  expect(apiRes.status(), "GET /api/projects/1 should 403 for a non-owning SM").toBe(403);

  await page.goto("/projects/1");
  await expect(page.getByText("Betöltés...")).toBeVisible();
});

test("admin and management can edit a project they do not own (PATCH not blocked)", async ({ request }) => {
  // Deliberately only touches E2E_PROJECT.id (created by this audit, owned by
  // the e2e_role_project_manager/site_manager test users) — never mutates the
  // pre-existing seed projects (1/2/3), to avoid leaving residue in real dev data.
  for (const role of ["admin", "management"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.patch(`/api/projects/${E2E_PROJECT.id}`, {
      headers: authHeader(token),
      data: { status_text: `rbac-audit-touch-${role}` },
    });
    expect(res.ok(), `${role} PATCH /api/projects/${E2E_PROJECT.id} (not their own) should succeed`).toBeTruthy();
  }
});

test("procurement/billing/subcontractor CANNOT edit any project via API", async ({ request }) => {
  for (const role of ["procurement", "billing", "subcontractor"] as Role[]) {
    const token = await apiToken(request, role);
    for (const projectId of [E2E_PROJECT.id, ...SEED_OWNED_PROJECT_IDS]) {
      const res = await request.patch(`/api/projects/${projectId}`, {
        headers: authHeader(token),
        data: { status_text: `rbac-audit-touch-${role}` },
      });
      expect(res.status(), `${role} PATCH /api/projects/${projectId} should 403`).toBe(403);
    }
  }
});

test("project_manager/site_manager CAN edit own project via API, CANNOT edit others'", async ({ request }) => {
  for (const role of ["project_manager", "site_manager"] as Role[]) {
    const token = await apiToken(request, role);
    const own = await request.patch(`/api/projects/${E2E_PROJECT.id}`, {
      headers: authHeader(token),
      data: { status_text: `rbac-audit-touch-${role}-own` },
    });
    expect(own.ok(), `${role} should be able to PATCH own project`).toBeTruthy();
    for (const projectId of SEED_OWNED_PROJECT_IDS) {
      const other = await request.patch(`/api/projects/${projectId}`, {
        headers: authHeader(token),
        data: { status_text: `rbac-audit-touch-${role}-other` },
      });
      expect(other.status(), `${role} should NOT be able to PATCH project ${projectId}`).toBe(403);
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Finance module — FINANCE_ROLES = admin/management/billing; TIG opened to owning PM too.
// ---------------------------------------------------------------------------
test("Partners page: only admin/management/billing see create/edit controls", async ({ page }) => {
  for (const role of ALL_ROLES) {
    await loginAs(page, role);
    await page.goto("/partners");
    const canEdit = role === "admin" || role === "management" || role === "billing";
    const newBtn = page.getByRole("button", { name: "Új alvállalkozó" });
    if (canEdit) {
      await expect(newBtn, `${role} should see "Új alvállalkozó" button`).toBeVisible();
    } else {
      await expect(newBtn, `${role} should NOT see "Új alvállalkozó" button`).toHaveCount(0);
    }
  }
});

test("Finance API: partner create/update gated to admin/management/billing", async ({ request }) => {
  for (const role of ALL_ROLES) {
    const token = await apiToken(request, role);
    const shouldSucceed = role === "admin" || role === "management" || role === "billing";
    const res = await request.post("/api/finance/partners", {
      headers: authHeader(token),
      data: { name: `E2E RBAC Partner (${role})` },
    });
    if (shouldSucceed) {
      expect(res.ok(), `${role} should be able to create a Partner`).toBeTruthy();
    } else {
      expect(res.status(), `${role} should be forbidden from creating a Partner`).toBe(403);
    }
  }
});

test("Finance API: partners LIST is open to any authenticated role (no gate)", async ({ request }) => {
  // finance.py::list_partners has no _require_finance_role call — confirming this
  // is intentional-but-worth-flagging behavior, not assuming it from reading code alone.
  for (const role of ["procurement", "subcontractor", "site_manager"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.get("/api/finance/partners", { headers: authHeader(token) });
    expect(res.ok(), `${role} GET /api/finance/partners`).toBeTruthy();
  }
});

test("Finance API: TIG create — finance roles + owning PM only, not other PM/SM/procurement/subcontractor", async ({ request }) => {
  const tigBody = { partner_id: E2E_PARTNER.id, date: "2026-08-12", period_start: "2026-08-01", period_end: "2026-08-12", net_value: "1000", vat_type: "standard_27" };

  // A TIG requires an ACTIVE subcontractor contract for the same
  // (project, partner) pair (added 2026-08-12) — set one up via admin
  // first, since creating a contract is finance-role-only, unlike TIG
  // creation which is also opened to the owning PM below.
  const adminToken = await apiToken(request, "admin");
  const contractRes = await request.post(`/api/finance/projects/${E2E_PROJECT.id}/subcontractor-contracts`, {
    headers: authHeader(adminToken),
    data: { partner_id: E2E_PARTNER.id, scope_of_work: "RBAC teszt", value: "500000", vat_type: "standard_27", start_date: "2026-07-01", end_date: "2026-12-31" },
  });
  expect(contractRes.ok(), "admin should be able to set up the prerequisite contract").toBeTruthy();
  const contract = await contractRes.json();
  const activateRes = await request.patch(
    `/api/finance/projects/${E2E_PROJECT.id}/subcontractor-contracts/${contract.id}/status`,
    { headers: authHeader(adminToken), data: { status: "active" } },
  );
  expect(activateRes.ok(), "admin should be able to activate the prerequisite contract").toBeTruthy();

  // owning PM (role project_manager, owns E2E_PROJECT.id) — should succeed
  const pmToken = await apiToken(request, "project_manager");
  const pmOwn = await request.post(`/api/finance/projects/${E2E_PROJECT.id}/tigs`, { headers: authHeader(pmToken), data: tigBody });
  expect(pmOwn.ok(), "owning PM should be able to create a TIG on own project").toBeTruthy();

  // same PM on a project they don't own — should 403
  const pmOther = await request.post(`/api/finance/projects/1/tigs`, { headers: authHeader(pmToken), data: tigBody });
  expect(pmOther.status(), "non-owning PM should be forbidden from creating a TIG").toBe(403);

  // site_manager (even on own project) — should 403, TIG is finance-role or owning-PM only
  const smToken = await apiToken(request, "site_manager");
  const smOwn = await request.post(`/api/finance/projects/${E2E_PROJECT.id}/tigs`, { headers: authHeader(smToken), data: tigBody });
  expect(smOwn.status(), "site_manager should be forbidden from creating a TIG even on own project").toBe(403);

  // procurement/subcontractor — should 403
  for (const role of ["procurement", "subcontractor"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.post(`/api/finance/projects/${E2E_PROJECT.id}/tigs`, { headers: authHeader(token), data: tigBody });
    expect(res.status(), `${role} should be forbidden from creating a TIG`).toBe(403);
  }
});

test("Finance overview (cross-project): admin/management/billing/project_manager allowed, site_manager/procurement/subcontractor forbidden", async ({ request }) => {
  for (const role of ["admin", "management", "billing", "project_manager"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.get("/api/finance/overview", { headers: authHeader(token) });
    expect(res.ok(), `${role} GET /api/finance/overview`).toBeTruthy();
  }
  for (const role of ["site_manager", "procurement", "subcontractor"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.get("/api/finance/overview", { headers: authHeader(token) });
    expect(res.status(), `${role} GET /api/finance/overview should 403`).toBe(403);
  }
});

test("/finance nav link visibility matches _require_overview_role gate", async ({ page }) => {
  const expectedVisible: Role[] = ["admin", "management", "billing", "project_manager"];
  for (const role of ALL_ROLES) {
    await loginAs(page, role);
    const link = page.getByRole("link", { name: "Pénzügy", exact: true });
    if (expectedVisible.includes(role)) {
      await expect(link).toBeVisible();
    } else {
      await expect(link).toHaveCount(0);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. CRM module — owner-chain scoping (Customer.owner_id), per scoping.py.
// ---------------------------------------------------------------------------
let e2eCustomerId: number;

test("CRM: PM creates a customer (becomes owner)", async ({ request }) => {
  const token = await apiToken(request, "project_manager");
  const res = await request.post("/api/crm/customers", {
    headers: authHeader(token),
    data: { type: "company", relationship_type: "customer", name: "E2E RBAC Ügyfél Kft." },
  });
  expect(res.ok(), "owning PM should be able to create a customer").toBeTruthy();
  const body = await res.json();
  e2eCustomerId = body.id;
  expect(body.owner_id).toBe(USER_IDS.project_manager);
});

test("CRM: owner-chain — non-owning site_manager cannot see PM's customer, admin/management can", async ({ request }) => {
  test.skip(!e2eCustomerId, "depends on previous test creating the customer");
  const smToken = await apiToken(request, "site_manager");
  const smList = await request.get("/api/crm/customers", { headers: authHeader(smToken) });
  const smBody = await smList.json();
  expect(smBody.some((c: { id: number }) => c.id === e2eCustomerId), "non-owning SM should not see PM's customer in list").toBeFalsy();
  const smGet = await request.get(`/api/crm/customers/${e2eCustomerId}`, { headers: authHeader(smToken) });
  expect(smGet.status(), "non-owning SM GET single customer should 404 (scoped query)").toBe(404);

  for (const role of ["admin", "management"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.get(`/api/crm/customers/${e2eCustomerId}`, { headers: authHeader(token) });
    expect(res.ok(), `${role} should see any customer`).toBeTruthy();
  }
});

test("CRM: procurement/subcontractor have NO general customer visibility (scoped_customer_query -> false())", async ({ request }) => {
  test.skip(!e2eCustomerId, "depends on customer-creation test");
  for (const role of ["procurement", "subcontractor"] as Role[]) {
    const token = await apiToken(request, role);
    const list = await request.get("/api/crm/customers", { headers: authHeader(token) });
    const body = await list.json();
    expect(Array.isArray(body) ? body.length : -1, `${role} customer list should be empty`).toBe(0);
    const single = await request.get(`/api/crm/customers/${e2eCustomerId}`, { headers: authHeader(token) });
    expect(single.status(), `${role} GET single customer should 404`).toBe(404);
  }
});

test("CRM: billing sees every customer (read-only) via scoped_customer_query_readonly", async ({ request }) => {
  // Changed 2026-08-12: billing already had unscoped access to every
  // Contract, but no way to reach a contract's own page (only a tab on its
  // customer's detail page) — now sees every customer too, but still can't
  // edit one (enforced separately in update_customer).
  test.skip(!e2eCustomerId, "depends on customer-creation test");
  const token = await apiToken(request, "billing");
  const list = await request.get("/api/crm/customers", { headers: authHeader(token) });
  const body = await list.json();
  expect(body.some((c: { id: number }) => c.id === e2eCustomerId), "billing should see the PM's customer in the list").toBeTruthy();
  const single = await request.get(`/api/crm/customers/${e2eCustomerId}`, { headers: authHeader(token) });
  expect(single.ok(), "billing GET single customer should succeed").toBeTruthy();
  const patch = await request.patch(`/api/crm/customers/${e2eCustomerId}`, {
    headers: authHeader(token),
    data: { phone: "+36301112233" },
  });
  expect(patch.status(), "billing should NOT be able to edit a customer").toBe(404);
});

test("CRM: procurement/billing/subcontractor forbidden from creating a customer", async ({ request }) => {
  // Fixed 2026-08-12: create_customer previously had no role gate at all —
  // any authenticated user could create a customer, including roles with
  // zero later visibility into it. Restricted to admin/management/
  // project_manager/site_manager (the two CRM-mapped roles).
  for (const role of ["procurement", "billing", "subcontractor"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.post("/api/crm/customers", {
      headers: authHeader(token),
      data: { type: "company", relationship_type: "customer", name: `E2E RBAC Ghost Ügyfél (${role})` },
    });
    expect(res.status(), `${role} create_customer should be 403`).toBe(403);
  }
});

test("CRM nav link (Ügyfelek) visibility matches NAV_CRM roles", async ({ page }) => {
  const expectedVisible: Role[] = ["admin", "management", "project_manager", "site_manager", "billing"];
  for (const role of ALL_ROLES) {
    await loginAs(page, role);
    const link = page.getByRole("link", { name: "Ügyfelek (CRM)", exact: true });
    if (expectedVisible.includes(role)) {
      await expect(link).toBeVisible();
    } else {
      await expect(link).toHaveCount(0);
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Users / Audit log pages.
// ---------------------------------------------------------------------------
test("/users page: only admin sees the management UI, others see 'Nincs jogosultságod'", async ({ page }) => {
  for (const role of ALL_ROLES) {
    await loginAs(page, role);
    await page.goto("/users");
    if (role === "admin") {
      await expect(page.getByRole("heading", { name: "Felhasználók" })).toBeVisible();
    } else {
      await expect(page.getByText("Nincs jogosultságod ehhez a felülethez.")).toBeVisible();
    }
  }
});

test("GET /api/auth/users: only admin/management allowed", async ({ request }) => {
  for (const role of ["admin", "management"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.get("/api/auth/users", { headers: authHeader(token) });
    expect(res.ok(), `${role} GET /api/auth/users`).toBeTruthy();
  }
  for (const role of ["project_manager", "site_manager", "procurement", "billing", "subcontractor"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.get("/api/auth/users", { headers: authHeader(token) });
    expect(res.status(), `${role} GET /api/auth/users should 403`).toBe(403);
  }
});

test("POST /api/auth/users (create user): admin only", async ({ request }) => {
  const mgmtToken = await apiToken(request, "management");
  const res = await request.post("/api/auth/users", {
    headers: authHeader(mgmtToken),
    data: { username: "e2e_should_not_be_created", email: "e2e_should_not_be_created@example.com", full_name: "x", password: "x", role: "project_manager" },
  });
  expect(res.status(), "management should NOT be able to create users").toBe(403);
});

test("/audit-log page: admin/management see the UI, others see 'Nincs jogosultságod'", async ({ page }) => {
  for (const role of ALL_ROLES) {
    await loginAs(page, role);
    await page.goto("/audit-log");
    if (role === "admin" || role === "management") {
      await expect(page.getByRole("heading", { name: "Audit napló" })).toBeVisible();
    } else {
      await expect(page.getByText("Nincs jogosultságod ehhez a felülethez.")).toBeVisible();
    }
  }
});

test("GET /api/audit-logs: procurement/billing/subcontractor forbidden server-side", async ({ request }) => {
  // Fixed 2026-08-12: this endpoint used to have no role gate at all for
  // these three roles — dashboard.py::audit_logs only narrowed results for
  // PROJECT_MANAGER/SITE_MANAGER, so everyone else fell through with no
  // filter and got the full, unfiltered org-wide audit log via direct API
  // call even though the frontend page hid the nav link from them. Now
  // blocked outright (403) rather than given a scoped view.
  for (const role of ["procurement", "billing", "subcontractor"] as Role[]) {
    const token = await apiToken(request, role);
    const res = await request.get("/api/audit-logs", { headers: authHeader(token) });
    expect(res.status(), `${role} GET /api/audit-logs should be 403`).toBe(403);
  }
});

// ---------------------------------------------------------------------------
// 7. Subcontractor role — dead-end check.
// ---------------------------------------------------------------------------
test("subcontractor: sees only primary nav, no CRM/finance/admin access, sees no project until one has a subcontractor-assigned activity", async ({ page, request }) => {
  await loginAs(page, "subcontractor");
  for (const label of ["Ügyfelek (CRM)", "Pénzügy", "Felhasználók", "Audit napló", "Alvállalkozói törzs"]) {
    await expect(page.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
  await page.goto("/projects");
  await page.getByRole("button", { name: "Lista" }).click();
  for (const code of ALL_PROJECT_CODES) {
    await expect(page.getByText(code, { exact: true })).toHaveCount(0);
  }

  const token = await apiToken(request, "subcontractor");
  const patch = await request.patch(`/api/projects/${E2E_PROJECT.id}`, { headers: authHeader(token), data: { status_text: "sub-touch" } });
  expect(patch.status()).toBe(403);
  const partners = await request.post("/api/finance/partners", { headers: authHeader(token), data: { name: "x" } });
  expect(partners.status()).toBe(403);
});

test("subcontractor: project becomes visible once it has an active activity assigned to their role", async ({ request }) => {
  // E2E_PROJECT.id (created directly by admin for this audit, not via the
  // project wizard) has zero activities — use a seeded project instead,
  // which was created through the normal flow and has the default
  // auto-generated activity list. Ownership doesn't matter for this check.
  const seededProjectId = SEED_OWNED_PROJECT_IDS[0];
  const adminToken = await apiToken(request, "admin");
  const subToken = await apiToken(request, "subcontractor");

  const before = await request.get("/api/projects", { headers: authHeader(subToken) });
  expect((await before.json()).some((p: { id: number }) => p.id === seededProjectId)).toBeFalsy();

  const activitiesRes = await request.get(`/api/projects/${seededProjectId}/activities`, { headers: authHeader(adminToken) });
  const activities = await activitiesRes.json();
  expect(activities.length, "seeded project should have activities").toBeGreaterThan(0);
  const [firstActivity] = activities;
  const originalRole = firstActivity.responsible_role;
  const assign = await request.patch(
    `/api/projects/${seededProjectId}/activities/${firstActivity.id}`,
    { headers: authHeader(adminToken), data: { responsible_role: "subcontractor" } },
  );
  expect(assign.ok()).toBeTruthy();

  try {
    const after = await request.get("/api/projects", { headers: authHeader(subToken) });
    expect((await after.json()).some((p: { id: number }) => p.id === seededProjectId), "project should now be visible").toBeTruthy();
    const detail = await request.get(`/api/projects/${seededProjectId}`, { headers: authHeader(subToken) });
    expect(detail.ok(), "project detail should now be viewable").toBeTruthy();
  } finally {
    // revert so other tests' project-visibility assumptions aren't disturbed
    await request.patch(
      `/api/projects/${seededProjectId}/activities/${firstActivity.id}`,
      { headers: authHeader(adminToken), data: { responsible_role: originalRole } },
    );
  }
});
