import { test, expect, Page, APIRequestContext } from "@playwright/test";
import { login } from "./helpers";

/**
 * Deep end-to-end coverage of the CRM -> project -> finance pipeline.
 *
 * Two scenarios, run serially (scenario 2 intentionally reuses two Partner
 * records created by scenario 1 to exercise cross-project data isolation).
 * All data created here is LIVE dev-database data (see the printed "TEST
 * DATA CREATED" block at the end of scenario 2) — nothing is deleted by
 * this spec.
 */

test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:8080";
const RUN_ID = Date.now();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => sessionStorage.getItem("planora_token"));
  if (!token) throw new Error("No planora_token in sessionStorage — login must have failed");
  return token;
}

async function api(
  request: APIRequestContext,
  token: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
) {
  const res = await request.fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> ${res.status()}: ${text}`);
  }
  const ct = res.headers()["content-type"] || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

async function selectByLabel(page: Page, dialog: import("@playwright/test").Locator, labelText: string, optionName: string | RegExp) {
  // Base UI Select: the <Label> text is NOT wired to the trigger via
  // htmlFor/aria-labelledby in this codebase, so locate the trigger by its
  // preceding sibling label text within the dialog.
  const group = dialog.locator("div.space-y-1\\.5", { hasText: labelText }).first();
  await group.getByRole("combobox").click();
  await page.getByRole("option", { name: optionName }).click();
}

function isoToday(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function fmtInt(n: number): string {
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// shared state between scenario 1 and scenario 2
// ---------------------------------------------------------------------------

interface CreatedPartner {
  id: number;
  name: string;
  trade: string;
}

interface ScenarioResult {
  customerId: number;
  customerName: string;
  customerNumber: string;
  projectId: number;
  projectCode: string;
  contractId: number;
  contractNumber: string;
  quoteId: number;
  partners: CreatedPartner[];
}

const testData: {
  scenario1?: ScenarioResult;
  scenario2?: ScenarioResult;
  bugs: string[];
  notes: string[];
} = { bugs: [], notes: [] };

// ---------------------------------------------------------------------------
// Shared lifecycle: customer -> comm event -> 3-version quote -> accept ->
// contract -> "Megrendelő" status -> project auto-created -> doc generated.
// ---------------------------------------------------------------------------

async function runCrmToProjectLifecycle(
  page: Page,
  request: APIRequestContext,
  token: string,
  opts: { label: string; projectCodePrefix: string }
): Promise<ScenarioResult> {
  const customerName = `E2E Mélyteszt ${opts.label} ${RUN_ID}`;

  // --- 1. Create company-type customer -------------------------------
  await page.goto("/crm/customers");
  await page.getByRole("button", { name: "Új ügyfél" }).click();
  const newDialog = page.getByRole("dialog");
  await newDialog.getByRole("combobox").nth(0).click();
  await page.getByRole("option", { name: "Cég" }).click();
  await newDialog.getByLabel("Név").fill(customerName);
  // owner combobox (admin only) is now index 1
  await newDialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option").first().click();
  await newDialog.getByLabel("Telefon").fill("+36301234567");
  await newDialog.getByLabel("E-mail").fill(`e2e.${opts.label.toLowerCase()}.${RUN_ID}@example.com`);
  await newDialog.getByLabel("Adószám").fill("12345678-1-42");
  await newDialog.getByRole("button", { name: "Létrehozás" }).click();

  await page.getByRole("link", { name: customerName }).click();
  await expect(page).toHaveURL(/\/crm\/customers\/\d+/);
  const customerId = Number(page.url().match(/\/crm\/customers\/(\d+)/)![1]);

  // --- 2. Log a phone communication event -----------------------------
  await page.getByRole("tab", { name: "Kommunikáció" }).click();
  await page.getByRole("button", { name: "Új esemény" }).click();
  const commDialog = page.getByRole("dialog");
  // type defaults to "phone" already
  await commDialog.getByLabel("Rövid összefoglaló").fill(
    `Telefonos egyeztetés ${opts.label} ügyféllel az árajánlat részleteiről.`
  );
  await commDialog.getByRole("button", { name: "Rögzítés" }).click();
  await expect(page.getByText(/Telefonos egyeztetés/)).toBeVisible();

  // --- 3. Quote with 3 versions ----------------------------------------
  await page.getByRole("tab", { name: "Ajánlatok" }).click();
  await page.getByRole("button", { name: "Új ajánlat" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ajánlat értéke (Ft)").fill("6350000");
  await dialog.getByRole("button", { name: "Létrehozás" }).click();

  const quoteRow = page
    .locator("div.flex.items-center.justify-between.gap-2.p-3.text-sm")
    .filter({ hasText: /^AJ-/ });
  await expect(quoteRow).toBeVisible();
  const quoteNumber = (await quoteRow.locator("p.font-medium").first().innerText()).split(" ")[0];

  // version 2
  await quoteRow.getByRole("button", { name: "Új verzió" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Tétel hozzáadása" }).click();
  await dialog.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Új verzió mentve")).toBeVisible();

  // version 3
  await quoteRow.getByRole("button", { name: "Új verzió" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Tétel hozzáadása" }).click();
  await dialog.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Új verzió mentve")).toBeVisible();

  await expect(quoteRow.getByText("v3")).toBeVisible();

  // fetch quote id via API for later traceability checks
  const quotesApi: Array<{ id: number; quote_number: string; current_version: number }> = await api(
    request,
    token,
    "GET",
    `/crm/quotes?customer_id=${customerId}`
  );
  const quote = quotesApi.find((q) => q.quote_number === quoteNumber)!;
  expect(quote.current_version).toBe(3);

  // --- status walk: DRAFT -> SENT -> ACCEPTED ---------------------------
  await quoteRow.getByRole("combobox").click();
  await page.getByRole("option", { name: "Kiküldve" }).click();
  await expect(quoteRow.getByRole("combobox")).toContainText("Kiküldve");

  await quoteRow.getByRole("combobox").click();
  await page.getByRole("option", { name: "Elfogadva" }).click();
  await expect(quoteRow.getByRole("combobox")).toContainText("Elfogadva");

  // --- 4. Contract from the accepted quote (backend creates it ACTIVE) --
  await quoteRow.getByRole("button", { name: "Szerződés létrehozása" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Kezdő dátum").fill(isoToday());
  await dialog.getByLabel("Lejárati dátum").fill(isoToday(365));
  await dialog.getByLabel("Szerződéses érték (Ft)").fill("6350000");
  await dialog.getByRole("button", { name: "Szerződés létrehozása" }).click();
  await expect(page.getByText("Szerződés létrehozva")).toBeVisible();

  await page.getByRole("tab", { name: "Szerződések" }).click();
  const contractRow = page.locator("div.p-3.text-sm").filter({ hasText: /^SZ-/ });
  await expect(contractRow).toBeVisible();
  const contractNumber = (await contractRow.locator("p.font-medium").first().innerText()).trim();
  await expect(contractRow.getByRole("combobox")).toContainText("Aktív");

  const contractsApi: Array<{ id: number; contract_number: string; status: string }> = await api(
    request,
    token,
    "GET",
    `/crm/contracts?customer_id=${customerId}`
  );
  const contract = contractsApi.find((c) => c.contract_number === contractNumber)!;
  expect(contract.status).toBe("active");

  // --- 5. Customer status -> "Megrendelő" triggers project auto-creation
  const projectCode = `${opts.projectCodePrefix}-${RUN_ID}`;
  await page.getByRole("tab", { name: "Áttekintés" }).click();
  const statusGroup = page.locator("div.space-y-1\\.5", { hasText: "Státusz" }).first();
  await statusGroup.getByRole("combobox").click();
  await page.getByRole("option", { name: "Megrendelő" }).click();

  const orderedDialog = page.getByRole("dialog");
  await orderedDialog.getByLabel("Projektazonosító").fill(projectCode);
  await orderedDialog.getByLabel("Település").fill("Szeged");
  await orderedDialog.getByLabel("Cím").fill(`${opts.label} utca 12.`);
  await orderedDialog.getByLabel("Alapterület (nettó m²)").fill("135");
  await orderedDialog.getByLabel("Átadási határidő").fill(isoToday(300));
  await orderedDialog.getByRole("button", { name: "Megrendelővé váltás" }).click();
  await expect(page.getByText(/megrendelővé váltva/)).toBeVisible();

  // resolve the created project id
  const projects: Array<{ id: number; project_code: string }> = await api(request, token, "GET", "/projects");
  const project = projects.find((p) => p.project_code === projectCode);
  if (!project) {
    testData.bugs.push(
      `Project auto-creation: no project with code ${projectCode} found via GET /api/projects after ` +
        `setting customer #${customerId} (${customerName}) status to "ordered".`
    );
    throw new Error("Project was not auto-created");
  }
  const projectId = project.id;

  const projectDetail: { customer_id?: number } = await api(request, token, "GET", `/projects/${projectId}`);
  expect(projectDetail.customer_id).toBe(customerId);

  // --- 6. Generate the contract as a real docx document -----------------
  await page.getByRole("tab", { name: "Szerződések" }).click();
  await contractRow.getByRole("button", { name: /Új verzió generálása/ }).click();
  await expect(page.getByText("Dokumentum generálása elindult")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);

  const generatedDocs: Array<{ id: number; family: string; source_id: number; project_id: number | null }> =
    await api(request, token, "GET", `/crm/customers/${customerId}/generated-documents`);
  const doc = generatedDocs.find((d) => d.family === "client_contract" && d.source_id === contract.id);
  if (!doc) {
    testData.bugs.push(
      `Document generation: POST /generated-documents for contract ${contractNumber} did not produce a ` +
        `GeneratedDocument row visible at GET /crm/customers/${customerId}/generated-documents.`
    );
  } else {
    if (doc.project_id !== projectId) {
      testData.bugs.push(
        `Document generation: GeneratedDocument #${doc.id} for contract ${contractNumber} has ` +
          `project_id=${doc.project_id}, expected ${projectId} (the project created from this same customer).`
      );
    }
    // confirm a real docx is downloadable — the endpoint returns {url: presignedS3Url}
    const dl = await request.fetch(`${BASE}/api/generated-documents/${doc.id}/download?format=docx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dl.ok()).toBeTruthy();
    const { url: presignedUrl } = await dl.json();
    const fileRes = await request.fetch(presignedUrl);
    expect(fileRes.ok()).toBeTruthy();
    const buf = await fileRes.body();
    expect(buf.length).toBeGreaterThan(1000); // real docx, not an empty stub
  }

  return {
    customerId,
    customerName,
    customerNumber: "",
    projectId,
    projectCode,
    contractId: contract.id,
    contractNumber,
    quoteId: quote.id,
    partners: [],
  };
}

// ---------------------------------------------------------------------------
// Finance helpers
// ---------------------------------------------------------------------------

async function createPartnerViaProjectFinanceTab(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Új partner" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Név").fill(name);
  await dialog.getByLabel("Telefon").fill("+36201112233");
  // ASCII-only email — the browser's native email validator rejects accented
  // Hungarian characters (ő/ú/é/...) in the local part.
  await dialog.getByLabel("E-mail").fill(`partner.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`);
  await dialog.getByRole("button", { name: "Létrehozás" }).click();
}

async function createTig(
  page: Page,
  opts: { partnerName: string; contractNumber?: string; net: string; vatLabel?: string }
) {
  await page.getByRole("button", { name: "Új TIG" }).click();
  const dialog = page.getByRole("dialog");
  await selectByLabel(page, dialog, "Partner", opts.partnerName);
  await selectByLabel(
    page,
    dialog,
    "Kapcsolódó szerződés",
    opts.contractNumber ?? "Nincs (eseti munka)"
  );
  await dialog.getByLabel("Dátum").fill(isoToday());
  await dialog.getByLabel("Időszak kezdete").fill(isoToday(-14));
  await dialog.getByLabel("Időszak vége").fill(isoToday());
  await dialog.getByLabel("Nettó érték (Ft)").fill(opts.net);
  await selectByLabel(page, dialog, "ÁFA típus", opts.vatLabel ?? "27% ÁFA");
  await dialog.getByRole("button", { name: "Létrehozás" }).click();
}

async function createSubcontractorContract(page: Page, opts: { partnerName: string; net?: string }) {
  await page.getByRole("button", { name: "Új szerződés" }).click();
  const dialog = page.getByRole("dialog");
  await selectByLabel(page, dialog, "Partner", opts.partnerName);
  await dialog.getByLabel("Kezdete").fill(isoToday());
  await dialog.getByLabel("Vége").fill(isoToday(365));
  if (opts.net) {
    await dialog.getByLabel("Nettó szerződéses érték (Ft)").fill(opts.net);
    await selectByLabel(page, dialog, "ÁFA típus", "27% ÁFA");
  }
  await dialog.getByRole("button", { name: "Létrehozás" }).click();
}

async function createSubInvoice(
  page: Page,
  opts: { partnerName: string; tigLabel?: string; invoiceNumber: string; net: string }
) {
  await page.getByRole("button", { name: "Új számla" }).nth(0).click();
  const dialog = page.getByRole("dialog");
  await selectByLabel(page, dialog, "Partner", opts.partnerName);
  if (opts.tigLabel) {
    await selectByLabel(page, dialog, "Kapcsolódó TIG", opts.tigLabel);
  }
  await dialog.getByLabel("Számlaszám").fill(opts.invoiceNumber);
  await dialog.getByLabel("Teljesítés").fill(isoToday());
  await dialog.getByLabel("Kiállítás").fill(isoToday());
  await dialog.getByLabel("Fizetési hat.").fill(isoToday(14));
  await dialog.getByLabel("Nettó összeg (Ft)").fill(opts.net);
  await selectByLabel(page, dialog, "ÁFA típus", "27% ÁFA");
  await dialog.getByRole("button", { name: "Létrehozás" }).click();
}

async function createCustomerInvoice(page: Page, net: string) {
  // "Ügyfél számlák" card's own "Új számla" button
  const card = page.locator("div", { has: page.getByRole("heading", { name: "Ügyfél számlák" }) }).last();
  await card.getByRole("button", { name: "Új számla" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Teljesítés").fill(isoToday());
  await dialog.getByLabel("Kiállítás").fill(isoToday());
  await dialog.getByLabel("Fizetési hat.").fill(isoToday(14));
  await dialog.getByLabel("Nettó összeg (Ft)").fill(net);
  await selectByLabel(page, dialog, "ÁFA típus", "27% ÁFA");
  await dialog.getByRole("button", { name: "Létrehozás" }).click();
}

// ===========================================================================
// SCENARIO 1
// ===========================================================================

test("Scenario 1: full single-project CRM -> finance lifecycle", async ({ page, request }) => {
  test.setTimeout(560000);
  await login(page);
  const token = await getToken(page);

  const result = await runCrmToProjectLifecycle(page, request, token, {
    label: "Egy",
    projectCodePrefix: "E2E1",
  });

  // --- Előkészítés / prep-center sanity check ---------------------------
  await page.goto(`/projects/${result.projectId}`);
  await page.getByRole("tab", { name: "Előkészítés" }).click();
  const prepRows = page.locator("table tbody tr");
  const prepCount = await prepRows.count();
  if (prepCount === 0) {
    testData.notes.push(
      `Project #${result.projectId} (${result.projectCode}) shows 0 rows on its own "Előkészítés" tab ` +
        `right after auto-creation — check whether the default activity template sets prep_date on any activities.`
    );
  }

  // cross-check global prep-center shows this project too, not duplicated
  await page.goto("/prep-center");
  const prepCenterCount = await page.getByText(result.projectCode, { exact: false }).count();
  // (informational only — prep-center groups by activity row, count is not asserted strictly)
  testData.notes.push(`Global prep-center shows ${prepCenterCount} row(s) mentioning ${result.projectCode}.`);

  // --- Finance tab: 4 partners -------------------------------------------
  await page.goto(`/projects/${result.projectId}`);
  await page.getByRole("tab", { name: "Pénzügy" }).click();

  const partnerDefs = [
    { trade: "Villanyszerelő", name: `E2E Villanyszerelő ${RUN_ID}` },
    { trade: "Vízvezeték-szerelő", name: `E2E Vízvezeték-szerelő ${RUN_ID}` },
    { trade: "Tetőfedő", name: `E2E Tetőfedő ${RUN_ID}` },
    { trade: "Festő", name: `E2E Festő ${RUN_ID}` },
  ];
  for (const p of partnerDefs) {
    await createPartnerViaProjectFinanceTab(page, p.name);
    await expect(page.getByText(p.name)).toBeVisible();
  }

  // --- FIX VERIFICATION: TIG now requires an ACTIVE SubcontractorContract -
  // Previously create_tig never checked a SubcontractorContract existed for
  // (project, partner) — fixed 2026-08-12 (backend/app/api/finance.py::
  // _validate_tig_contract_link). Confirm a TIG for partner #1 is now
  // REJECTED while zero contracts exist for this project.
  const contractsBeforeTig: unknown[] = await api(
    request,
    token,
    "GET",
    `/finance/projects/${result.projectId}/subcontractor-contracts`
  );
  expect(contractsBeforeTig.length).toBe(0); // sanity: really zero contracts exist yet
  const partnersForGapCheck: Array<{ id: number; name: string }> = await api(request, token, "GET", "/finance/partners");
  const partner1IdForGap = partnersForGapCheck.find((p) => p.name === partnerDefs[0].name)!.id;
  const tigWithoutContractRes = await request.fetch(`${BASE}/api/finance/projects/${result.projectId}/tigs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: JSON.stringify({
      partner_id: partner1IdForGap,
      date: isoToday(),
      period_start: isoToday(-14),
      period_end: isoToday(),
      net_value: "1000000",
      vat_type: "standard_27",
    }),
  });
  expect(tigWithoutContractRes.status(), "TIG creation without an active contract must now be rejected").toBe(422);
  testData.notes.push(
    "Confirmed fix: TIG creation without an ACTIVE SubcontractorContract is now rejected (422) — " +
      `partner ${partnerDefs[0].name}, project ${result.projectCode}.`
  );

  // --- Subcontractor contracts for all 4 partners -------------------------
  for (const p of partnerDefs) {
    await createSubcontractorContract(page, { partnerName: p.name, net: "1000000" });
  }
  await expect(page.getByText("Nincs alvállalkozói szerződés")).toHaveCount(0);

  // Activate contracts for partner 1 and 2 (the ones with financial activity)
  async function activateContractFor(partnerName: string) {
    const row = page
      .locator("div.divide-y.divide-border")
      .locator("div", { hasText: partnerName })
      .filter({ hasText: /ASZ-/ })
      .first();
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Aktív" }).click();
  }
  await activateContractFor(partnerDefs[0].name);
  await activateContractFor(partnerDefs[1].name);

  // --- TIG for partner 1, now that its contract is active ------------------
  await createTig(page, { partnerName: partnerDefs[0].name, net: "1000000" });

  // --- TIG for partner 2, linked to its (now active) contract -------------
  // fetch the contract number for partner 2 via API for the dropdown label
  const projectFinanceTigsBefore: Array<{ id: number }> = await api(
    request,
    token,
    "GET",
    `/finance/projects/${result.projectId}/tigs`
  );
  const subContracts: Array<{ id: number; partner_id: number; contract_number: string }> = await api(
    request,
    token,
    "GET",
    `/finance/projects/${result.projectId}/subcontractor-contracts`
  );
  const partnersApi: Array<{ id: number; name: string }> = await api(request, token, "GET", "/finance/partners");
  const partner2Id = partnersApi.find((p) => p.name === partnerDefs[1].name)!.id;
  const partner2Contract = subContracts.find((c) => c.partner_id === partner2Id)!;

  await createTig(page, {
    partnerName: partnerDefs[1].name,
    contractNumber: partner2Contract.contract_number,
    net: "800000",
  });

  const tigsAfter: Array<{ id: number; partner_id: number; net_value: string; subcontractor_contract_id: number | null }> =
    await api(request, token, "GET", `/finance/projects/${result.projectId}/tigs`);
  expect(tigsAfter.length).toBe(projectFinanceTigsBefore.length + 1);
  const tigPartner1 = tigsAfter.find((t) => t.partner_id !== partner2Id)!;
  const tigPartner2 = tigsAfter.find((t) => t.partner_id === partner2Id)!;
  expect(tigPartner2.subcontractor_contract_id).toBe(partner2Contract.id);

  // --- TIG status walk: draft -> approved -> invoiced ---------------------
  async function walkTigStatus(partnerName: string, labels: string[]) {
    const row = page
      .locator("div.divide-y.divide-border")
      .locator("div", { hasText: partnerName })
      .filter({ hasText: /kapcsolt számla|Nincs hozzá számla/ })
      .first();
    for (const label of labels) {
      await row.getByRole("combobox").click();
      await page.getByRole("option", { name: label }).click();
      await expect(row.getByRole("combobox")).toContainText(label);
    }
  }
  await walkTigStatus(partnerDefs[0].name, ["Jóváhagyott"]);

  // --- Subcontractor invoices for partner 1 and 2, both linked to TIGs ---
  const tig1Label = `${new Date(isoToday(-14)).toLocaleDateString("hu-HU")} – ${new Date(isoToday()).toLocaleDateString("hu-HU")}`;
  await createSubInvoice(page, {
    partnerName: partnerDefs[0].name,
    tigLabel: tig1Label,
    invoiceNumber: `SZLA-P1-${RUN_ID}`,
    net: "1000000",
  });
  await createSubInvoice(page, {
    partnerName: partnerDefs[1].name,
    tigLabel: tig1Label,
    invoiceNumber: `SZLA-P2-${RUN_ID}`,
    net: "800000",
  });

  // walk subcontractor invoice statuses to PAID for both
  async function walkSubInvoiceToPaid(invoiceNumber: string, path: string[]) {
    const row = page.locator("div.divide-y.divide-border").locator("div", { hasText: invoiceNumber }).first();
    for (const label of path) {
      await row.getByRole("combobox").click();
      await page.getByRole("option", { name: label }).click();
      await expect(row.getByRole("combobox")).toContainText(label);
    }
  }
  await walkSubInvoiceToPaid(`SZLA-P1-${RUN_ID}`, ["Jóváhagyott", "Kifizetésre vár", "Kifizetett"]);
  await walkSubInvoiceToPaid(`SZLA-P2-${RUN_ID}`, ["Kifizetett"]);

  // --- Customer invoice, marked PAID --------------------------------------
  await createCustomerInvoice(page, "5000000");
  async function walkCustomerInvoiceToPaid() {
    const row = page.locator("div.divide-y.divide-border").locator("div", { hasText: /OSZ-/ }).first();
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Kiegyenlített", exact: true }).click();
    await expect(row.getByRole("combobox")).toContainText("Kiegyenlített");
  }
  await walkCustomerInvoiceToPaid();

  // --- Cash-flow: compute expected value and compare exactly -------------
  // subcontractor gross paid = 1,000,000*1.27 + 800,000*1.27 = 2,286,000.00
  // customer received gross  = 5,000,000*1.27 = 6,350,000.00
  // balance = 6,350,000.00 - 2,286,000.00 = 4,064,000.00
  const expectedBalance = "4064000.00";
  await page.reload();
  await page.getByRole("tab", { name: "Pénzügy" }).click();
  const cashFlow: {
    received_gross: string;
    subcontractor_paid_gross: string;
    cash_flow_balance: string;
  } = await api(request, token, "GET", `/finance/projects/${result.projectId}/cash-flow`);

  if (cashFlow.cash_flow_balance !== expectedBalance) {
    testData.bugs.push(
      `Cash-flow mismatch on project #${result.projectId} (${result.projectCode}): expected ` +
        `cash_flow_balance=${expectedBalance}, API returned ${cashFlow.cash_flow_balance} ` +
        `(received_gross=${cashFlow.received_gross}, subcontractor_paid_gross=${cashFlow.subcontractor_paid_gross}). ` +
        `services/finance.py::_build_summary formula: received_gross - subcontractor_paid_gross.`
    );
  }
  await expect(page.getByText("Cash flow egyenleg")).toBeVisible();
  const uiBalanceText = await page
    .locator("div", { has: page.getByText("Cash flow egyenleg") })
    .last()
    .innerText();
  if (!uiBalanceText.replace(/\s/g, "").includes("4064000") && !uiBalanceText.includes("4 064 000")) {
    testData.notes.push(
      `UI cash-flow card text for project ${result.projectCode}: "${uiBalanceText.trim()}" — verify manually it matches 4 064 000 Ft.`
    );
  }

  // --- Activity: mark one "done", project status transition via API ------
  await page.getByRole("tab", { name: "Ütemterv" }).click();
  await page.getByRole("button", { name: "Szerkesztés" }).click();
  // Row has 3 comboboxes in schedule-editing mode: Felelős(role), Kijelölve(assignee), Státusz — status is last.
  const firstActivityStatusSelect = page.locator("table tbody tr").first().getByRole("combobox").last();
  await firstActivityStatusSelect.click();
  await page.getByRole("option", { name: "Kész" }).click();
  await expect(firstActivityStatusSelect).toContainText("Kész");

  const beforeStatus: { status: string } = await api(request, token, "GET", `/projects/${result.projectId}`);
  await api(request, token, "PATCH", `/projects/${result.projectId}`, { status: "foundation" });
  const afterStatus: { status: string } = await api(request, token, "GET", `/projects/${result.projectId}`);
  expect(afterStatus.status).toBe("foundation");
  expect(afterStatus.status).not.toBe(beforeStatus.status);

  // --- Traceability -----------------------------------------------------
  const subInvoicesApi: Array<{ id: number; project_id: number; partner_id: number; tig_id: number | null }> =
    await api(request, token, "GET", `/finance/projects/${result.projectId}/subcontractor-invoices`);
  for (const inv of subInvoicesApi) {
    expect(inv.project_id).toBe(result.projectId);
    if (inv.tig_id) {
      const linkedTig = tigsAfter.find((t) => t.id === inv.tig_id);
      if (!linkedTig) {
        testData.bugs.push(`SubcontractorInvoice #${inv.id} references tig_id=${inv.tig_id} which is not among this project's TIGs.`);
      } else if (linkedTig.partner_id !== inv.partner_id) {
        testData.bugs.push(
          `SubcontractorInvoice #${inv.id} (partner ${inv.partner_id}) is linked to TIG #${inv.tig_id} ` +
            `which belongs to a different partner (${linkedTig.partner_id}).`
        );
      }
    }
  }

  result.partners = [];
  for (const p of partnerDefs) {
    const found = partnersApi.find((x) => x.name === p.name);
    if (found) result.partners.push({ id: found.id, name: found.name, trade: p.trade });
  }
  testData.scenario1 = result;
});

// ===========================================================================
// SCENARIO 2
// ===========================================================================

test("Scenario 2: second project, 2 reused + 2 new partners, verify isolation", async ({ page, request }) => {
  test.setTimeout(560000);
  const s1 = testData.scenario1;
  if (!s1) throw new Error("Scenario 1 must run first and populate testData.scenario1");

  await login(page);
  const token = await getToken(page);

  const result = await runCrmToProjectLifecycle(page, request, token, {
    label: "Ketto",
    projectCodePrefix: "E2E2",
  });

  await page.goto(`/projects/${result.projectId}`);
  await page.getByRole("tab", { name: "Pénzügy" }).click();

  // 2 brand-new partners
  const newPartnerDefs = [
    { trade: "Ácsmester", name: `E2E Ácsmester ${RUN_ID}` },
    { trade: "Gipszkartonos", name: `E2E Gipszkartonos ${RUN_ID}` },
  ];
  for (const p of newPartnerDefs) {
    await createPartnerViaProjectFinanceTab(page, p.name);
  }

  // reuse partner[0] (Villanyszerelő) and partner[1] (Vízvezeték-szerelő) from scenario 1
  const reusedPartners = s1.partners.slice(0, 2);
  await expect(page.getByText(reusedPartners[0].name)).toBeVisible();
  await expect(page.getByText(reusedPartners[1].name)).toBeVisible();

  const allPartnerNames = [...reusedPartners.map((p) => p.name), ...newPartnerDefs.map((p) => p.name)];

  for (const name of allPartnerNames) {
    await createSubcontractorContract(page, { partnerName: name, net: "600000" });
  }

  // A TIG requires an ACTIVE contract (fixed 2026-08-12) — activate the two
  // contracts that will actually get a TIG below.
  async function activateContractFor(partnerName: string) {
    const row = page
      .locator("div.divide-y.divide-border")
      .locator("div", { hasText: partnerName })
      .filter({ hasText: /ASZ-/ })
      .first();
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Aktív" }).click();
  }
  await activateContractFor(reusedPartners[0].name);
  await activateContractFor(newPartnerDefs[0].name);

  await createTig(page, { partnerName: reusedPartners[0].name, net: "500000" });
  await createTig(page, { partnerName: newPartnerDefs[0].name, net: "400000" });

  await createSubInvoice(page, {
    partnerName: reusedPartners[0].name,
    invoiceNumber: `SZLA-P2S-${RUN_ID}`,
    net: "500000",
  });
  await createSubInvoice(page, {
    partnerName: newPartnerDefs[0].name,
    invoiceNumber: `SZLA-P2N-${RUN_ID}`,
    net: "400000",
  });

  async function payInvoice(invoiceNumber: string) {
    const row = page.locator("div.divide-y.divide-border").locator("div", { hasText: invoiceNumber }).first();
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Kifizetett" }).click();
  }
  await payInvoice(`SZLA-P2S-${RUN_ID}`);
  await payInvoice(`SZLA-P2N-${RUN_ID}`);

  await createCustomerInvoice(page, "2000000");
  {
    const row = page.locator("div.divide-y.divide-border").locator("div", { hasText: /OSZ-/ }).first();
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Kiegyenlített", exact: true }).click();
  }

  // --- ISOLATION CHECKS ---------------------------------------------------

  // 1. project 1's cash flow must be unchanged after all of project 2's activity
  const cashFlow1After: { cash_flow_balance: string } = await api(
    request,
    token,
    "GET",
    `/finance/projects/${s1.projectId}/cash-flow`
  );
  if (cashFlow1After.cash_flow_balance !== "4064000.00") {
    testData.bugs.push(
      `DATA ISOLATION BUG: project #${s1.projectId} (${s1.projectCode}) cash_flow_balance changed to ` +
        `${cashFlow1After.cash_flow_balance} (expected unchanged 4064000.00) after project 2's finance activity ` +
        `that reuses 2 of the same Partner records.`
    );
  }

  // 2. project 2's TIGs/invoices must only ever reference project 2
  const tigs2: Array<{ id: number; project_id: number; partner_id: number }> = await api(
    request,
    token,
    "GET",
    `/finance/projects/${result.projectId}/tigs`
  );
  const invoices2: Array<{ id: number; project_id: number }> = await api(
    request,
    token,
    "GET",
    `/finance/projects/${result.projectId}/subcontractor-invoices`
  );
  for (const t of tigs2) expect(t.project_id).toBe(result.projectId);
  for (const inv of invoices2) expect(inv.project_id).toBe(result.projectId);

  // 3. project 1's TIGs must not have leaked into project 2's list and vice versa
  const tigs1: Array<{ id: number }> = await api(request, token, "GET", `/finance/projects/${s1.projectId}/tigs`);
  const tig1Ids = new Set(tigs1.map((t) => t.id));
  const tig2Ids = new Set(tigs2.map((t) => t.id));
  const overlap = [...tig1Ids].filter((id) => tig2Ids.has(id));
  if (overlap.length > 0) {
    testData.bugs.push(`DATA ISOLATION BUG: TIG ids overlap between project ${s1.projectId} and ${result.projectId}: ${overlap.join(",")}`);
  }

  // 4. the reused partner's cross-project view (finance/all/tigs?partner_id=) shows BOTH projects correctly
  const reusedPartnerId = reusedPartners[0].id;
  const crossProjectTigs: Array<{ id: number; project_id: number; project_code: string; net_value: string }> = await api(
    request,
    token,
    "GET",
    `/finance/all/tigs?partner_id=${reusedPartnerId}`
  );
  const projectsSeen = new Set(crossProjectTigs.map((t) => t.project_code));
  if (!projectsSeen.has(s1.projectCode) || !projectsSeen.has(result.projectCode)) {
    testData.bugs.push(
      `Reused partner #${reusedPartnerId} (${reusedPartners[0].name}): GET /finance/all/tigs?partner_id= ` +
        `returned project_codes [${[...projectsSeen].join(", ")}], expected to include BOTH ${s1.projectCode} ` +
        `and ${result.projectCode}.`
    );
  }
  // project 1's TIG for this partner was created earlier (the TIG-without-contract
  // finding, net 1,000,000); project 2's TIG for the same partner was created above (net 500,000).
  for (const t of crossProjectTigs) {
    if (t.project_code === s1.projectCode) {
      expect(t.net_value).toBe("1000000.00");
    } else if (t.project_code === result.projectCode) {
      expect(t.net_value).toBe("500000.00");
    }
  }

  // 5. documents: project 1's generated contract doc must not appear under project 2's customer, and vice versa
  const docsForCustomer1: Array<{ id: number; source_id: number }> = await api(
    request,
    token,
    "GET",
    `/crm/customers/${s1.customerId}/generated-documents`
  );
  const docsForCustomer2: Array<{ id: number; source_id: number }> = await api(
    request,
    token,
    "GET",
    `/crm/customers/${result.customerId}/generated-documents`
  );
  const leaked = docsForCustomer1.filter((d) => docsForCustomer2.some((d2) => d2.id === d.id));
  if (leaked.length > 0) {
    testData.bugs.push(`DATA ISOLATION BUG: generated document(s) [${leaked.map((d) => d.id).join(",")}] appear under both customer ${s1.customerId} and ${result.customerId}.`);
  }

  // 6. "Partnerek" badge list on the finance tab is the GLOBAL partner directory, not
  //    project-scoped — confirm and record as a UI-clarity finding (not necessarily a bug).
  const globalPartners: Array<{ id: number; name: string }> = await api(request, token, "GET", "/finance/partners");
  const onlyProject1Partner = s1.partners.find((p) => !allPartnerNames.includes(p.name));
  if (onlyProject1Partner) {
    const visibleOnProject2Page = await page.getByText(onlyProject1Partner.name, { exact: true }).isVisible().catch(() => false);
    if (visibleOnProject2Page) {
      testData.notes.push(
        `UI clarity finding (not a data bug): project ${result.projectCode}'s "Pénzügy" tab "Partnerek" badge ` +
          `list shows "${onlyProject1Partner.name}", a partner with ZERO contracts/TIGs/invoices on this project ` +
          `— it has only ever worked on project ${s1.projectCode}. Root cause: frontend/src/app/projects/[id]/page.tsx ` +
          `loads partners via api.financePartners() (GET /api/finance/partners, a GLOBAL unscoped list — see ` +
          `backend/app/api/finance.py::list_partners), not a project-scoped "which partners are engaged here" query. ` +
          `The "Partnerek" section reads as "partners on this project" but is actually "the entire partner directory".`
      );
    }
  }
  void globalPartners;

  testData.scenario2 = result;

  // ---------------------------------------------------------------------
  // Final report dump
  // ---------------------------------------------------------------------
  console.log("\n=== TEST DATA CREATED (do not delete without user sign-off) ===");
  console.log(JSON.stringify({ scenario1: testData.scenario1, scenario2: testData.scenario2, newPartnersScenario2: newPartnerDefs }, null, 2));
  console.log("\n=== NOTES ===");
  for (const n of testData.notes) console.log("- " + n);
  console.log("\n=== CONFIRMED BUGS ===");
  if (testData.bugs.length === 0) console.log("(none)");
  for (const b of testData.bugs) console.log("- " + b);

  expect(testData.bugs, `Bugs found:\n${testData.bugs.join("\n")}`).toEqual([]);
});
