const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  has_avatar: boolean;
}

export interface ProjectCard {
  id: number;
  name: string;
  project_code: string;
  settlement: string;
  client_name: string;
  building_type: string;
  floor_area_sqm: number;
  status: string;
  delivery_date: string;
  completion_percent: number;
  project_manager_name?: string;
  site_manager_name?: string;
  has_thumbnail: boolean;
  is_favorite: boolean;
  health: string;
  finance_status: string;
  latitude?: number;
  longitude?: number;
  waiting_deadline?: string;
  planning_deadline?: string;
  foundation_deadline?: string;
  structure_deadline?: string;
  exterior_done_deadline?: string;
  turnkey_deadline?: string;
}

export interface ProjectDetail extends ProjectCard {
  delay_risk: string;
  delay_risk_reason: string;
  address: string;
  lot_number?: string;
  client_phone?: string;
  client_email?: string;
  client_phone_2?: string;
  client_email_2?: string;
  project_manager_id?: number;
  site_manager_id?: number;
  procurement_id?: number;
  procurement_name?: string;
  billing_id?: number;
  billing_name?: string;
  subcontractors?: string;
  status_text?: string;
  customer_id?: number;
  contract_net_value?: string;
  contract_vat_type?: string;
  contract_gross_value?: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  name: string;
  duration_days: number;
  prep_days: number;
  responsible_role: string;
  assignee_id?: number;
  assignee_name?: string;
  start_date?: string;
  end_date?: string;
  prep_date?: string;
  status: string;
  is_active: boolean;
  sort_order: number;
  prerequisite_ids: number[];
  category: string;
  documentation_subtype?: string;
  notes?: string;
  status_text?: string;
  reminder_date?: string;
}

export interface ActivityTemplate {
  id: number;
  name: string;
  duration_days: number;
  sort_order: number;
  default_prep_days: number;
  responsible_role: string;
  prerequisite_template_ids: number[];
  include_by_default: boolean;
  category: string;
  documentation_subtype?: string;
}

export interface PrepTask {
  project_id: number;
  project_name: string;
  client_name: string;
  activity_id: number;
  activity_name: string;
  prep_date?: string;
  start_date?: string;
  responsible_role: string;
  status: string;
  status_text?: string;
  reminder_date?: string;
  is_overdue: boolean;
  days_until?: number;
}

export interface TaskBoardItem {
  activity_id: number;
  activity_name: string;
  status: string;
  responsible_role: string;
  duration_days: number;
  category: string;
  documentation_subtype?: string;
  notes?: string;
  status_text?: string;
  reminder_date?: string;
  assignee_id?: number;
  assignee_name?: string;
  start_date?: string;
  end_date?: string;
  prep_date?: string;
  project_id: number;
  project_name: string;
  project_code: string;
  client_name: string;
  settlement: string;
  delivery_date: string;
  project_status: string;
  project_manager_name?: string;
  site_manager_name?: string;
  has_thumbnail: boolean;
}

export interface UserBrief {
  id: number;
  full_name: string;
  role: string;
}

export interface WeeklyWorkloadItem {
  week_start: string;
  activity_count: number;
}

export interface DashboardStats {
  overdue_tasks: number;
  upcoming_prep_7d: number;
  upcoming_prep_14d: number;
  slipping_projects: number;
  total_projects: number;
  on_time_delivery_pct: number;
  handovers_this_month: number;
  open_prep_tasks_total: number;
  weekly_workload: WeeklyWorkloadItem[];
}

export interface ProjectDocument {
  id: number;
  filename: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  version: number;
  created_at: string;
}

export interface ProjectPhoto {
  id: number;
  filename: string;
  content_type: string;
  file_size: number;
  taken_at: string;
  comment?: string;
  uploaded_by_name?: string;
  created_at: string;
}

export interface DigestPreview {
  overdue: PrepTask[];
  upcoming: PrepTask[];
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  related_project_id?: number;
  related_project_name?: string;
  created_at: string;
  read_at?: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number;
  user_name?: string;
  project_id?: number;
  project_name?: string;
  entity_type: string;
  entity_id?: number;
  field_name: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface CrmCustomer {
  id: number;
  customer_number: string;
  type: string;
  relationship_type: string;
  name: string;
  status: string;
  owner_id: number;
  phone?: string;
  email?: string;
  tax_number?: string;
  billing_address?: string;
  mailing_address?: string;
  company_registry_number?: string;
  bank_account_number?: string;
  representative_name?: string;
  representative_title?: string;
  contact_name?: string;
  source?: string;
  created_at: string;
}

export interface CrmCustomerCreateResult extends CrmCustomer {
  duplicate_name_warning: boolean;
}

export interface CrmCustomerRelation {
  id: number;
  company_customer_id: number;
  person_customer_id: number;
  role_label?: string;
  is_primary: boolean;
}

export interface CrmImportRowResult {
  row: number;
  success: boolean;
  customer_number?: string;
  name?: string;
  error?: string;
}

export interface CrmQuoteVersion {
  id: number;
  version: number;
  content_json: Record<string, unknown>;
  created_at: string;
  created_by_id: number;
}

export interface CrmQuote {
  id: number;
  customer_id: number;
  quote_number: string;
  date: string;
  status: string;
  current_version: number;
  sent_at?: string;
  value?: string;
  versions: CrmQuoteVersion[];
}

export interface ValidQuotesSummary {
  count: number;
  total_value: string;
}

export interface ProjectCreationFields {
  project_code?: string;
  settlement?: string;
  address?: string;
  floor_area_sqm?: number;
  delivery_date?: string;
  lot_number?: string;
}

export interface CrmContract {
  id: number;
  customer_id: number;
  quote_id?: number;
  own_company_id?: number;
  contract_number: string;
  contract_type?: string;
  start_date: string;
  end_date: string;
  effective_date?: string;
  status: string;
  value?: string;
  net_value_standard?: string;
  net_value_reduced?: string;
  currency: string;
  payment_due_date?: string;
  payment_method?: string;
  signed_at?: string;
}

export interface CrmCommunicationEvent {
  id: number;
  customer_id: number;
  type: string;
  date: string;
  agent_id: number;
  summary: string;
  created_at: string;
}

export interface CrmTask {
  id: number;
  name: string;
  customer_id: number;
  due_date: string;
  owner_id: number;
  status: string;
  priority: string;
  created_at: string;
}

export interface CrmDashboardStats {
  total_customers: number;
  active_customers: number;
  new_customers_30d: number;
  customers_by_type: Record<string, number>;
  open_tasks: number;
  active_contracts: number;
  expiring_contracts_30d: number;
  pending_quotes: number;
}

export interface PipelineBucket {
  status: string;
  count: number;
}

export interface SalesDashboardWeekly {
  week_start: string;
  week_end: string;
  contracts_signed_count: number;
  contracts_signed_value: string;
  active_customers: number;
  new_inquiries: number;
  quotes_sent: number;
  site_visits: number;
  pipeline: PipelineBucket[];
}

export interface TrendPoint {
  year: number;
  month: number;
  contracted_value: string;
}

export interface SourceBreakdown {
  source: string | null;
  count: number;
}

export interface ConversionFunnel {
  leads: number;
  negotiations: number;
  contracts: number;
  lead_to_negotiation_pct: number;
  negotiation_to_contract_pct: number;
}

export interface SalesDashboardMonthly {
  month: string;
  total_contracted_value: string;
  average_contract_value?: string;
  average_sales_cycle_days?: number;
  trend: TrendPoint[];
  source_breakdown: SourceBreakdown[];
  funnel: ConversionFunnel;
}

export interface CrmSearchResult {
  type: string;
  id: number;
  label: string;
  sublabel?: string;
  customer_id: number;
}

export interface CrmDocumentItem {
  id: number;
  original_filename: string;
  content_type: string;
  file_size: number;
  document_type: string;
  version: number;
  uploaded_by_id: number;
  created_at: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("planora_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("planora_refresh_token");
}

let meCache: Promise<User> | null = null;
let cachedUser: User | null = null;

/** Synchronously returns the last resolved /auth/me result, or null if not yet loaded. */
export function getCachedUser(): User | null {
  return cachedUser;
}

export function setTokens(accessToken: string, refreshToken: string) {
  sessionStorage.setItem("planora_token", accessToken);
  sessionStorage.setItem("planora_refresh_token", refreshToken);
  meCache = null;
  cachedUser = null;
}

export function clearToken() {
  sessionStorage.removeItem("planora_token");
  sessionStorage.removeItem("planora_refresh_token");
  meCache = null;
  cachedUser = null;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/** FastAPI error bodies are either {detail: string} or, for 422 validation
 * failures, {detail: [{loc, msg, type}, ...]} — the latter stringifies to
 * "[object Object]" if thrown as-is, so pull out the actual field messages. */
function formatErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (e && typeof e === "object" && "msg" in e) {
          const loc = Array.isArray(e.loc) ? e.loc.filter((p: unknown) => p !== "body").join(".") : undefined;
          return loc ? `${loc}: ${e.msg}` : String(e.msg);
        }
        return typeof e === "string" ? e : JSON.stringify(e);
      })
      .join("; ");
  }
  return null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    const isAuthEndpoint = path.startsWith("/auth/login") || path.startsWith("/auth/refresh");
    if (!isRetry && !isAuthEndpoint) {
      if (!refreshPromise) {
        refreshPromise = tryRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      if (await refreshPromise) {
        return request<T>(path, options, true);
      }
    }
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatErrorDetail(err.detail) || "Request failed");
  }
  return res.json();
}

/** Authenticated binary download (the endpoint needs a Bearer header, so a
 * plain <a href> can't hit it directly) — fetches as a blob and triggers a
 * save via a synthetic same-document anchor click, which — unlike
 * window.open — isn't subject to popup blockers. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatErrorDetail(err.detail) || "Letöltés sikertelen");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface Partner {
  id: number;
  name: string;
  tax_number?: string;
  phone?: string;
  email?: string;
  billing_address?: string;
  mailing_address?: string;
  company_registry_number?: string;
  bank_account_number?: string;
  representative_name?: string;
  representative_title?: string;
  contact_name?: string;
  created_at: string;
}

export interface OwnCompany {
  id: number;
  name: string;
  registered_address?: string;
  mailing_address?: string;
  tax_number?: string;
  company_registry_number?: string;
  bank_account_number?: string;
  representative_name?: string;
  representative_title?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Tig {
  id: number;
  project_id: number;
  partner_id: number;
  subcontractor_contract_id?: number;
  date: string;
  period_start: string;
  period_end: string;
  net_value: string;
  vat_type: string;
  gross_value: string;
  status: string;
  note?: string;
  created_at: string;
  updated_at: string;
  consumed_amount: string;
  invoice_count: number;
  project_name?: string;
  project_code?: string;
}

export interface SubcontractorInvoice {
  id: number;
  project_id: number;
  partner_id: number;
  tig_id?: number;
  invoice_number: string;
  performance_date: string;
  issue_date: string;
  due_date: string;
  payment_date?: string;
  net_value: string;
  vat_type: string;
  gross_value: string;
  paid_amount?: string;
  status: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  project_code?: string;
}

export interface CustomerInvoice {
  id: number;
  project_id: number;
  invoice_number: string;
  issue_date: string;
  performance_date: string;
  due_date: string;
  payment_received_date?: string;
  net_value: string;
  vat_type: string;
  gross_value: string;
  paid_amount?: string;
  status: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  project_name?: string;
  project_code?: string;
}

export interface SubcontractorContract {
  id: number;
  project_id: number;
  partner_id: number;
  own_company_id?: number;
  contract_number: string;
  contract_type?: string;
  scope_of_work?: string;
  value?: string;
  vat_type?: string;
  currency: string;
  payment_terms_days?: number;
  payment_method?: string;
  start_date: string;
  end_date: string;
  effective_date?: string;
  status: string;
  signed_at?: string;
  created_at: string;
  updated_at: string;
  project_name?: string;
  project_code?: string;
}

export interface DocumentTemplate {
  id: number;
  family: string;
  doc_subtype: string;
  building_type?: string;
  currency?: string;
  is_electronic: boolean;
  is_delay_variant: boolean;
  name: string;
  input_schema?: string;
  version: number;
  is_active: boolean;
  uploaded_by_id: number;
  created_at: string;
}

export interface GeneratedDocument {
  id: number;
  family: string;
  source_id: number;
  project_id?: number;
  template_id: number;
  doc_subtype: string;
  delay_reason?: string;
  status: string;
  has_pdf: boolean;
  version: number;
  generated_by_id: number;
  created_at: string;
}

export interface CashFlowSummary {
  contract_net?: string;
  contract_gross?: string;
  invoiced_net: string;
  invoiced_gross: string;
  received_gross: string;
  outstanding_receivable: string;
  tig_total_net: string;
  subcontractor_invoiced_gross: string;
  subcontractor_paid_gross: string;
  payable_obligations: string;
  expected_margin?: string;
  actual_margin: string;
  cash_flow_balance: string;
  has_overdue_customer_invoice: boolean;
  has_overdue_subcontractor_invoice: boolean;
  overdue_receivable: string;
  overdue_payable: string;
}

export interface ProjectFinanceOverviewRow {
  project_id: number;
  project_name: string;
  project_code: string;
  project_manager_name?: string;
  customer_name?: string;
  contract_gross?: string;
  invoiced_gross: string;
  received_gross: string;
  subcontractor_invoiced_gross: string;
  subcontractor_paid_gross: string;
  cash_flow_balance: string;
  overdue_receivable: string;
  overdue_payable: string;
  finance_status: string;
}

export type FinishLevel = "economy" | "standard" | "premium";
export type WallType = "light_steel" | "clt" | "timber_frame" | "brick";
export type RoofCoveringType = "tile" | "metal_sheet" | "shingle" | "flat_roof";
export type FoundationType = "strip" | "slab" | "point";

export interface RoughEstimateRate {
  id: number;
  category: string;
  wall_type?: WallType;
  roof_covering_type?: RoofCoveringType;
  foundation_type?: FoundationType;
  base_price: number;
  unit_label: string;
  is_active: boolean;
  updated_at: string;
}

export interface RoughEstimateSettings {
  economy_adjustment_pct: number;
  premium_adjustment_pct: number;
  updated_at: string;
}

export interface CostEstimateBreakdownLine {
  category: string;
  wall_type?: string | null;
  roof_covering_type?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CostEstimateRough {
  id: number;
  project_id: number;
  finish_level: FinishLevel;
  floor_area_sqm: number;
  exterior_wall_fm: number;
  exterior_wall_type: WallType;
  interior_wall_fm: number;
  interior_wall_type: WallType;
  has_basement: boolean;
  basement_wall_fm: number;
  walkable_slab_sqm: number;
  light_slab_sqm: number;
  roof_area_sqm: number;
  roof_covering_type: RoofCoveringType;
  foundation_type: FoundationType;
  breakdown: CostEstimateBreakdownLine[];
  total_net_min: number;
  total_net_max: number;
  notes?: string;
  created_by_id?: number;
  created_by_name?: string;
  created_at: string;
}

export type PriceCatalogSource = "own" | "terc_import";

export interface PriceCatalogItem {
  id: number;
  code: string;
  description: string;
  unit: string;
  chapter: string;
  unit_price_material: string;
  unit_price_labor: string;
  unit_price_total: string;
  source: PriceCatalogSource;
  source_reference?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CostEstimateDetailedItem {
  id: number;
  catalog_item_id?: number;
  code?: string;
  description: string;
  unit: string;
  chapter: string;
  quantity: string;
  unit_price_material: string;
  unit_price_labor: string;
  line_total: string;
  sort_order: number;
}

export interface ChapterSubtotal {
  chapter: string;
  total: string;
}

export interface CostEstimateDetailed {
  id: number;
  project_id: number;
  name: string;
  notes?: string;
  items: CostEstimateDetailedItem[];
  chapter_subtotals: ChapterSubtotal[];
  grand_total: string;
  created_by_id?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CostEstimateDetailedSummary {
  id: number;
  project_id: number;
  name: string;
  grand_total: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TransferToQuoteResult {
  quote_id: number;
  quote_number: string;
  customer_id: number;
}

export interface PriceCatalogImportParseResult {
  columns: string[];
  rows: (string | null)[][];
  suggested_mapping: Record<string, number>;
  row_count: number;
  sheet_names: string[];
  sheet_name: string;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>("/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  pilotStatus: () => request<{ pilot_mode: boolean }>("/auth/pilot-status"),

  pilotLogin: () =>
    request<{ access_token: string; refresh_token: string }>("/auth/pilot-login", {
      method: "POST",
    }),

  // AppLayout and several pages each want the current user on mount; share
  // one in-flight/just-resolved request instead of firing /auth/me per page.
  me: () => {
    if (!meCache) {
      meCache = request<User>("/auth/me")
        .then((user) => { cachedUser = user; return user; })
        .catch((err) => { meCache = null; cachedUser = null; throw err; });
    }
    return meCache;
  },

  kanban: () => request<Record<string, ProjectCard[]>>("/projects/kanban"),

  taskKanban: () => request<Record<string, TaskBoardItem[]>>("/tasks/kanban"),

  usersDirectory: () => request<UserBrief[]>("/auth/users/directory"),

  projects: () => request<ProjectCard[]>("/projects"),

  exportProjects: () => downloadFile("/projects/export", "projektek.xlsx"),

  project: (id: number) => request<ProjectDetail>(`/projects/${id}`),

  createProject: (data: Record<string, unknown>) =>
    request<ProjectDetail>("/projects", { method: "POST", body: JSON.stringify(data) }),

  updateProject: (id: number, data: Record<string, unknown>) =>
    request<ProjectDetail>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteProject: (id: number) =>
    request<{ ok: boolean; deleted: string }>(`/projects/${id}`, { method: "DELETE" }),

  activities: (projectId: number) => request<Activity[]>(`/projects/${projectId}/activities`),

  createActivity: (projectId: number, data: Record<string, unknown>) =>
    request<Activity>(`/projects/${projectId}/activities`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateActivity: (projectId: number, activityId: number, data: Record<string, unknown>) =>
    request<Activity>(`/projects/${projectId}/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteActivity: (projectId: number, activityId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/activities/${activityId}`, {
      method: "DELETE",
    }),

  dashboardStats: () => request<DashboardStats>("/dashboard/stats"),

  prepCenter: (filter = "all") => request<PrepTask[]>(`/tasks/prep-center?filter=${filter}`),

  myTasks: () => request<PrepTask[]>("/tasks/my-tasks"),

  users: () => request<User[]>("/auth/users"),

  createUser: (data: Record<string, unknown>) =>
    request<User>("/auth/users", { method: "POST", body: JSON.stringify(data) }),

  updateUser: (id: number, data: Record<string, unknown>) =>
    request<User>(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  documents: (projectId: number) =>
    request<ProjectDocument[]>(`/projects/${projectId}/documents`),

  uploadDocument: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<ProjectDocument>(`/projects/${projectId}/documents`, {
      method: "POST",
      body: formData,
    });
  },

  downloadDocument: (projectId: number, documentId: number) =>
    request<{ url: string }>(`/projects/${projectId}/documents/${documentId}/download`),

  deleteDocument: (projectId: number, documentId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/documents/${documentId}`, {
      method: "DELETE",
    }),

  addDependency: (projectId: number, activityId: number, prerequisiteId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/activities/${activityId}/dependencies`, {
      method: "POST",
      body: JSON.stringify({ prerequisite_id: prerequisiteId }),
    }),

  removeDependency: (projectId: number, activityId: number, prerequisiteId: number) =>
    request<{ ok: boolean }>(
      `/projects/${projectId}/activities/${activityId}/dependencies/${prerequisiteId}`,
      { method: "DELETE" }
    ),

  auditLogs: (projectId?: number) =>
    request<AuditLogEntry[]>(`/audit-logs${projectId ? `?project_id=${projectId}` : ""}`),

  slippingProjects: () => request<ProjectCard[]>("/dashboard/slipping-projects"),

  activityTemplates: () => request<ActivityTemplate[]>("/activity-templates"),

  createActivityTemplate: (data: Record<string, unknown>) =>
    request<ActivityTemplate>("/activity-templates", { method: "POST", body: JSON.stringify(data) }),

  updateActivityTemplate: (id: number, data: Record<string, unknown>) =>
    request<ActivityTemplate>(`/activity-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteActivityTemplate: (id: number) =>
    request<{ ok: boolean }>(`/activity-templates/${id}`, { method: "DELETE" }),

  setAllTemplatesIncludeByDefault: (include: boolean) =>
    request<{ ok: boolean }>("/activity-templates/include-all", {
      method: "PATCH",
      body: JSON.stringify({ include_by_default: include }),
    }),

  addTemplateDependency: (templateId: number, prerequisiteTemplateId: number) =>
    request<{ ok: boolean }>(`/activity-templates/${templateId}/dependencies`, {
      method: "POST",
      body: JSON.stringify({ prerequisite_template_id: prerequisiteTemplateId }),
    }),

  removeTemplateDependency: (templateId: number, prerequisiteTemplateId: number) =>
    request<{ ok: boolean }>(
      `/activity-templates/${templateId}/dependencies/${prerequisiteTemplateId}`,
      { method: "DELETE" }
    ),

  uploadAvatar: (userId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<User>(`/auth/users/${userId}/avatar`, { method: "POST", body: formData });
  },

  avatarUrl: (userId: number) => request<{ url: string }>(`/auth/users/${userId}/avatar-url`),

  deleteAvatar: (userId: number) =>
    request<User>(`/auth/users/${userId}/avatar`, { method: "DELETE" }),

  uploadThumbnail: (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ ok: boolean }>(`/projects/${projectId}/thumbnail`, { method: "POST", body: formData });
  },

  thumbnailUrl: (projectId: number) => request<{ url: string }>(`/projects/${projectId}/thumbnail-url`),

  deleteThumbnail: (projectId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/thumbnail`, { method: "DELETE" }),

  addFavorite: (projectId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/favorite`, { method: "POST" }),

  removeFavorite: (projectId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/favorite`, { method: "DELETE" }),

  photos: (projectId: number) => request<ProjectPhoto[]>(`/projects/${projectId}/photos`),

  uploadPhoto: (projectId: number, file: File, takenAt: string, comment?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("taken_at", takenAt);
    if (comment) formData.append("comment", comment);
    return request<ProjectPhoto>(`/projects/${projectId}/photos`, { method: "POST", body: formData });
  },

  downloadPhoto: (projectId: number, photoId: number) =>
    request<{ url: string }>(`/projects/${projectId}/photos/${photoId}/download`),

  deletePhoto: (projectId: number, photoId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/photos/${photoId}`, { method: "DELETE" }),

  notifications: () => request<Notification[]>("/notifications"),

  markNotificationRead: (id: number) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),

  search: (q: string) => request<ProjectCard[]>(`/search?q=${encodeURIComponent(q)}`),

  digestPreview: () => request<DigestPreview>("/notifications/digest-preview"),

  crmCustomers: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<CrmCustomer[]>(`/crm/customers${qs ? `?${qs}` : ""}`);
  },

  crmCustomer: (id: number) => request<CrmCustomer>(`/crm/customers/${id}`),

  createCrmCustomer: (data: Record<string, unknown>) =>
    request<CrmCustomerCreateResult>("/crm/customers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCrmCustomer: (id: number, data: Record<string, unknown>) =>
    request<CrmCustomer>(`/crm/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteCrmCustomer: (id: number) =>
    request<{ ok: boolean }>(`/crm/customers/${id}`, { method: "DELETE" }),

  exportCrmCustomers: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return downloadFile(`/crm/customers/export${qs ? `?${qs}` : ""}`, "ugyfelek.csv");
  },

  importCrmCustomers: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<{ results: CrmImportRowResult[] }>("/crm/customers/import", {
      method: "POST",
      body: formData,
    });
  },

  crmCustomerRelations: (customerId: number) =>
    request<CrmCustomerRelation[]>(`/crm/customer-relations?customer_id=${customerId}`),

  createCrmCustomerRelation: (data: Record<string, unknown>) =>
    request<CrmCustomerRelation>("/crm/customer-relations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteCrmCustomerRelation: (id: number) =>
    request<{ ok: boolean }>(`/crm/customer-relations/${id}`, { method: "DELETE" }),

  crmQuotesForCustomer: (customerId: number) =>
    request<CrmQuote[]>(`/crm/quotes?customer_id=${customerId}`),

  createCrmQuote: (customerId: number, contentJson: Record<string, unknown>, value?: string) =>
    request<CrmQuote>("/crm/quotes", {
      method: "POST",
      body: JSON.stringify({ customer_id: customerId, content_json: contentJson, value }),
    }),

  updateCrmQuote: (id: number, data: Record<string, unknown>) =>
    request<CrmQuote>(`/crm/quotes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  addCrmQuoteVersion: (id: number, contentJson: Record<string, unknown>) =>
    request<CrmQuote>(`/crm/quotes/${id}/versions`, {
      method: "POST",
      body: JSON.stringify({ content_json: contentJson }),
    }),

  updateCrmQuoteStatus: (id: number, status: string) =>
    request<CrmQuote>(`/crm/quotes/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  createContractFromQuote: (
    quoteId: number,
    startDate: string,
    endDate: string,
    projectFields?: ProjectCreationFields,
    value?: string
  ) =>
    request<CrmContract>(`/crm/quotes/${quoteId}/create-contract`, {
      method: "POST",
      body: JSON.stringify({ start_date: startDate, end_date: endDate, value, ...projectFields }),
    }),

  crmContractsForCustomer: (customerId: number) =>
    request<CrmContract[]>(`/crm/contracts?customer_id=${customerId}`),

  crmContracts: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<CrmContract[]>(`/crm/contracts${qs ? `?${qs}` : ""}`);
  },

  createCrmContract: (data: Record<string, unknown>) =>
    request<CrmContract>("/crm/contracts", { method: "POST", body: JSON.stringify(data) }),

  updateCrmContractStatus: (id: number, status: string, projectFields?: ProjectCreationFields) =>
    request<CrmContract>(`/crm/contracts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...projectFields }),
    }),

  updateCrmContract: (id: number, data: Record<string, unknown>) =>
    request<CrmContract>(`/crm/contracts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  crmCommunications: (customerId: number) =>
    request<CrmCommunicationEvent[]>(`/crm/communications?customer_id=${customerId}`),

  createCrmCommunication: (data: Record<string, unknown>) =>
    request<CrmCommunicationEvent>("/crm/communications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  crmTasksForCustomer: (customerId: number) =>
    request<CrmTask[]>(`/crm/tasks?customer_id=${customerId}`),

  crmTasks: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<CrmTask[]>(`/crm/tasks${qs ? `?${qs}` : ""}`);
  },

  createCrmTask: (data: Record<string, unknown>) =>
    request<CrmTask>("/crm/tasks", { method: "POST", body: JSON.stringify(data) }),

  updateCrmTask: (id: number, data: Record<string, unknown>) =>
    request<CrmTask>(`/crm/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  crmDocumentsFor: (entityType: string, entityId: number) =>
    request<CrmDocumentItem[]>(`/crm/documents?entity_type=${entityType}&entity_id=${entityId}`),

  uploadCrmDocument: (entityType: string, entityId: number, file: File) => {
    const formData = new FormData();
    formData.append("entity_type", entityType);
    formData.append("entity_id", String(entityId));
    formData.append("file", file);
    return request<CrmDocumentItem>("/crm/documents", { method: "POST", body: formData });
  },

  downloadCrmDocument: (id: number) =>
    request<{ url: string }>(`/crm/documents/${id}/download`),

  deleteCrmDocument: (id: number) =>
    request<{ ok: boolean }>(`/crm/documents/${id}`, { method: "DELETE" }),

  crmDashboardStats: () => request<CrmDashboardStats>("/crm/dashboard/stats"),

  crmSearch: (q: string) => request<CrmSearchResult[]>(`/crm/search?q=${encodeURIComponent(q)}`),

  salesDashboardWeekly: (weekStart?: string) =>
    request<SalesDashboardWeekly>(
      `/crm/sales-dashboard/weekly${weekStart ? `?week_start=${weekStart}` : ""}`
    ),

  salesDashboardMonthly: (month?: string) =>
    request<SalesDashboardMonthly>(
      `/crm/sales-dashboard/monthly${month ? `?month=${month}` : ""}`
    ),

  salesDashboardValidQuotes: () =>
    request<ValidQuotesSummary>("/crm/sales-dashboard/valid-quotes"),

  financePartners: () => request<Partner[]>("/finance/partners"),

  createFinancePartner: (data: Record<string, unknown>) =>
    request<Partner>("/finance/partners", { method: "POST", body: JSON.stringify(data) }),

  updateFinancePartner: (id: number, data: Record<string, unknown>) =>
    request<Partner>(`/finance/partners/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listOwnCompanies: (activeOnly?: boolean) =>
    request<OwnCompany[]>(`/finance/own-companies${activeOnly ? "?active_only=true" : ""}`),

  createOwnCompany: (data: Record<string, unknown>) =>
    request<OwnCompany>("/finance/own-companies", { method: "POST", body: JSON.stringify(data) }),

  updateOwnCompany: (id: number, data: Record<string, unknown>) =>
    request<OwnCompany>(`/finance/own-companies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  financeTigs: (projectId: number) =>
    request<Tig[]>(`/finance/projects/${projectId}/tigs`),

  createFinanceTig: (projectId: number, data: Record<string, unknown>) =>
    request<Tig>(`/finance/projects/${projectId}/tigs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFinanceTig: (projectId: number, tigId: number, data: Record<string, unknown>) =>
    request<Tig>(`/finance/projects/${projectId}/tigs/${tigId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateFinanceTigStatus: (projectId: number, tigId: number, status: string) =>
    request<Tig>(`/finance/projects/${projectId}/tigs/${tigId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  financeSubcontractorInvoices: (projectId: number) =>
    request<SubcontractorInvoice[]>(`/finance/projects/${projectId}/subcontractor-invoices`),

  createFinanceSubcontractorInvoice: (projectId: number, data: Record<string, unknown>) =>
    request<SubcontractorInvoice>(`/finance/projects/${projectId}/subcontractor-invoices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFinanceSubcontractorInvoice: (
    projectId: number,
    invoiceId: number,
    data: Record<string, unknown>
  ) =>
    request<SubcontractorInvoice>(
      `/finance/projects/${projectId}/subcontractor-invoices/${invoiceId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),

  updateFinanceSubcontractorInvoiceStatus: (
    projectId: number,
    invoiceId: number,
    status: string,
    paidAmount?: string
  ) =>
    request<SubcontractorInvoice>(
      `/finance/projects/${projectId}/subcontractor-invoices/${invoiceId}/status`,
      { method: "PATCH", body: JSON.stringify({ status, paid_amount: paidAmount }) }
    ),

  financeCustomerInvoices: (projectId: number) =>
    request<CustomerInvoice[]>(`/finance/projects/${projectId}/customer-invoices`),

  createFinanceCustomerInvoice: (projectId: number, data: Record<string, unknown>) =>
    request<CustomerInvoice>(`/finance/projects/${projectId}/customer-invoices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFinanceCustomerInvoice: (
    projectId: number,
    invoiceId: number,
    data: Record<string, unknown>
  ) =>
    request<CustomerInvoice>(`/finance/projects/${projectId}/customer-invoices/${invoiceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateFinanceCustomerInvoiceStatus: (
    projectId: number,
    invoiceId: number,
    status: string,
    paidAmount?: string
  ) =>
    request<CustomerInvoice>(
      `/finance/projects/${projectId}/customer-invoices/${invoiceId}/status`,
      { method: "PATCH", body: JSON.stringify({ status, paid_amount: paidAmount }) }
    ),

  financeCashFlow: (projectId: number) =>
    request<CashFlowSummary>(`/finance/projects/${projectId}/cash-flow`),

  updateProjectFinance: (projectId: number, data: Record<string, unknown>) =>
    request<{ contract_net_value?: string; contract_vat_type?: string; contract_gross_value?: string }>(
      `/finance/projects/${projectId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),

  financeOverview: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<ProjectFinanceOverviewRow[]>(`/finance/overview${qs ? `?${qs}` : ""}`);
  },

  financeAllTigs: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<Tig[]>(`/finance/all/tigs${qs ? `?${qs}` : ""}`);
  },

  financeAllSubcontractorInvoices: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<SubcontractorInvoice[]>(`/finance/all/subcontractor-invoices${qs ? `?${qs}` : ""}`);
  },

  financeAllCustomerInvoices: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<CustomerInvoice[]>(`/finance/all/customer-invoices${qs ? `?${qs}` : ""}`);
  },

  financeSubcontractorContracts: (projectId: number) =>
    request<SubcontractorContract[]>(`/finance/projects/${projectId}/subcontractor-contracts`),

  createFinanceSubcontractorContract: (projectId: number, data: Record<string, unknown>) =>
    request<SubcontractorContract>(`/finance/projects/${projectId}/subcontractor-contracts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFinanceSubcontractorContract: (
    projectId: number,
    contractId: number,
    data: Record<string, unknown>
  ) =>
    request<SubcontractorContract>(
      `/finance/projects/${projectId}/subcontractor-contracts/${contractId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),

  updateFinanceSubcontractorContractStatus: (projectId: number, contractId: number, status: string) =>
    request<SubcontractorContract>(
      `/finance/projects/${projectId}/subcontractor-contracts/${contractId}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) }
    ),

  listDocumentTemplates: (family?: string, activeOnly?: boolean) => {
    const params = new URLSearchParams();
    if (family) params.set("family", family);
    if (activeOnly) params.set("active_only", "true");
    const qs = params.toString();
    return request<DocumentTemplate[]>(`/document-templates${qs ? `?${qs}` : ""}`);
  },

  uploadDocumentTemplate: (data: {
    family: string;
    doc_subtype: string;
    building_type?: string;
    currency?: string;
    is_electronic: boolean;
    is_delay_variant: boolean;
    name: string;
    file: File;
  }) => {
    const formData = new FormData();
    formData.append("family", data.family);
    formData.append("doc_subtype", data.doc_subtype);
    if (data.building_type) formData.append("building_type", data.building_type);
    if (data.currency) formData.append("currency", data.currency);
    formData.append("is_electronic", String(data.is_electronic));
    formData.append("is_delay_variant", String(data.is_delay_variant));
    formData.append("name", data.name);
    formData.append("file", data.file);
    return request<DocumentTemplate>("/document-templates", { method: "POST", body: formData });
  },

  updateDocumentTemplate: (templateId: number, data: Record<string, unknown>) =>
    request<DocumentTemplate>(`/document-templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  generateDocument: (data: {
    family: string;
    source_id: number;
    doc_subtype?: string;
    delay_reason?: string;
    is_electronic?: boolean;
    template_id?: number;
  }) =>
    request<GeneratedDocument>("/generated-documents", { method: "POST", body: JSON.stringify(data) }),

  projectGeneratedDocuments: (projectId: number) =>
    request<GeneratedDocument[]>(`/projects/${projectId}/generated-documents`),

  customerGeneratedDocuments: (customerId: number) =>
    request<GeneratedDocument[]>(`/crm/customers/${customerId}/generated-documents`),

  downloadGeneratedDocument: (docId: number, format: "docx" | "pdf") =>
    request<{ url: string }>(`/generated-documents/${docId}/download?format=${format}`),

  deleteGeneratedDocument: (docId: number) =>
    request<{ ok: boolean }>(`/generated-documents/${docId}`, { method: "DELETE" }),

  costEstimateRates: () => request<RoughEstimateRate[]>("/cost-estimate-rates"),

  updateCostEstimateRate: (id: number, data: Record<string, unknown>) =>
    request<RoughEstimateRate>(`/cost-estimate-rates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  costEstimateSettings: () => request<RoughEstimateSettings>("/cost-estimate-settings"),

  updateCostEstimateSettings: (data: Record<string, unknown>) =>
    request<RoughEstimateSettings>("/cost-estimate-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  roughEstimates: (projectId: number) =>
    request<CostEstimateRough[]>(`/projects/${projectId}/cost-estimates/rough`),

  createRoughEstimate: (projectId: number, data: Record<string, unknown>) =>
    request<CostEstimateRough>(`/projects/${projectId}/cost-estimates/rough`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteRoughEstimate: (projectId: number, estimateId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/cost-estimates/rough/${estimateId}`, {
      method: "DELETE",
    }),

  priceCatalogChapters: () => request<string[]>("/price-catalog/chapters"),

  priceCatalogItems: (params: { search?: string; chapter?: string; active_only?: boolean; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.chapter) qs.set("chapter", params.chapter);
    if (params.active_only !== undefined) qs.set("active_only", String(params.active_only));
    // Backend default is 50 — the admin list page wants the full catalog
    // (up to the backend's own 1000-row cap) unless a caller asks for
    // fewer, e.g. the detailed-budget "add from catalog" search box.
    qs.set("limit", String(params.limit ?? 1000));
    const query = qs.toString();
    return request<PriceCatalogItem[]>(`/price-catalog?${query}`);
  },

  createPriceCatalogItem: (data: Record<string, unknown>) =>
    request<PriceCatalogItem>("/price-catalog", { method: "POST", body: JSON.stringify(data) }),

  updatePriceCatalogItem: (id: number, data: Record<string, unknown>) =>
    request<PriceCatalogItem>(`/price-catalog/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deletePriceCatalogItem: (id: number) =>
    request<{ ok: boolean }>(`/price-catalog/${id}`, { method: "DELETE" }),

  parsePriceCatalogImport: (file: File, sheet?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (sheet) formData.append("sheet", sheet);
    return request<PriceCatalogImportParseResult>("/price-catalog/import/parse", {
      method: "POST",
      body: formData,
    });
  },

  commitPriceCatalogImport: (data: {
    rows: (string | null)[][];
    mapping: Record<string, number>;
    source_reference: string;
  }) =>
    request<{ created: number; updated: number; skipped: number }>("/price-catalog/import/commit", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  detailedEstimates: (projectId: number) =>
    request<CostEstimateDetailedSummary[]>(`/projects/${projectId}/cost-estimates/detailed`),

  createDetailedEstimate: (projectId: number, data: { name: string; notes?: string }) =>
    request<CostEstimateDetailed>(`/projects/${projectId}/cost-estimates/detailed`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getDetailedEstimate: (projectId: number, estimateId: number) =>
    request<CostEstimateDetailed>(`/projects/${projectId}/cost-estimates/detailed/${estimateId}`),

  updateDetailedEstimate: (projectId: number, estimateId: number, data: Record<string, unknown>) =>
    request<CostEstimateDetailed>(`/projects/${projectId}/cost-estimates/detailed/${estimateId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteDetailedEstimate: (projectId: number, estimateId: number) =>
    request<{ ok: boolean }>(`/projects/${projectId}/cost-estimates/detailed/${estimateId}`, {
      method: "DELETE",
    }),

  addDetailedEstimateItem: (projectId: number, estimateId: number, data: Record<string, unknown>) =>
    request<CostEstimateDetailed>(`/projects/${projectId}/cost-estimates/detailed/${estimateId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDetailedEstimateItem: (
    projectId: number,
    estimateId: number,
    itemId: number,
    data: Record<string, unknown>
  ) =>
    request<CostEstimateDetailed>(
      `/projects/${projectId}/cost-estimates/detailed/${estimateId}/items/${itemId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),

  deleteDetailedEstimateItem: (projectId: number, estimateId: number, itemId: number) =>
    request<CostEstimateDetailed>(
      `/projects/${projectId}/cost-estimates/detailed/${estimateId}/items/${itemId}`,
      { method: "DELETE" }
    ),

  transferDetailedEstimateToQuote: (projectId: number, estimateId: number) =>
    request<TransferToQuoteResult>(
      `/projects/${projectId}/cost-estimates/detailed/${estimateId}/transfer-to-quote`,
      { method: "POST" }
    ),

  exportDetailedEstimateXlsx: (projectId: number, estimateId: number, filename: string) =>
    downloadFile(`/projects/${projectId}/cost-estimates/detailed/${estimateId}/export.xlsx`, filename),
};

export const STATUS_LABELS: Record<string, string> = {
  waiting: "Várakozik",
  planning: "Tervezés alatt",
  foundation: "Alapozás",
  structure: "Szerkezetállítás",
  exterior_done: "Kívülről kész",
  turnkey: "Kulcsrakész",
  closed: "Lezárva",
};

export const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-neutral-300",
  planning: "bg-accent-300",
  foundation: "bg-accent-400",
  structure: "bg-accent-500",
  exterior_done: "bg-accent-600",
  turnkey: "bg-accent-700",
  closed: "bg-neutral-700",
};

// Project field name (Project.<status>_deadline) for each per-phase kanban
// column — "closed" deliberately has none, it's a one-shot action not a
// scheduled phase.
export const PROJECT_STATUS_DEADLINE_FIELD: Record<string, string> = {
  waiting: "waiting_deadline",
  planning: "planning_deadline",
  foundation: "foundation_deadline",
  structure: "structure_deadline",
  exterior_done: "exterior_done_deadline",
  turnkey: "turnkey_deadline",
};

export const BUILDING_LABELS: Record<string, string> = {
  light_steel: "Könnyűszerkezetes",
  clt: "CLT",
  timber_frame: "Gerendaház",
  other: "Egyéb",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Projektmenedzser",
  management: "Menedzsment",
  procurement: "Beszerzés",
  billing: "Számlázás",
  site_manager: "Építésvezető",
  subcontractor: "Alvállalkozó",
};

export const CATEGORY_LABELS: Record<string, string> = {
  foundation: "Alapozás",
  timber_frame: "Favázszerkezet",
  roofing: "Tetőszerkezet",
  exterior_openings: "Külső nyílászárók",
  electrical: "Villanyszerelés",
  mechanical: "Gépészet",
  insulation: "Szigetelés",
  flooring: "Burkolás",
  interior: "Beltéri munkák",
  finishing: "Festés",
  facade: "Homlokzat",
  landscaping: "Kertészet",
  procurement: "Beszerzés",
  planning: "Tervezés",
  documentation: "Dokumentáció",
  other: "Egyéb",
};

export const CRM_CUSTOMER_TYPE_LABELS: Record<string, string> = {
  person: "Magánszemély",
  company: "Cég",
  sole_proprietor: "Egyéni vállalkozó",
};

// The customer's own status IS the sales pipeline (no separate Lead/
// Opportunity entity) — reaching "ordered" auto-creates the project.
export const CRM_CUSTOMER_STATUS_LABELS: Record<string, string> = {
  new: "Új",
  inquiring: "Érdeklődő",
  quote_sent: "Ajánlatadás",
  ordered: "Megrendelő",
  archived: "Archivált",
};

export const CRM_CUSTOMER_STATUS_ORDER = ["new", "inquiring", "quote_sent", "ordered", "archived"];

export const CRM_SOURCE_LABELS: Record<string, string> = {
  referral: "Ajánlás",
  facebook_instagram: "Facebook / Instagram",
  website_seo: "Weboldal / SEO",
  other: "Egyéb",
};
export const CRM_SOURCE_UNKNOWN_LABEL = "Ismeretlen";

export const CRM_CUSTOMER_STATUS_COLORS: Record<string, string> = {
  new: "bg-neutral-100 text-neutral-700",
  inquiring: "bg-accent-100 text-accent-700",
  quote_sent: "bg-warning-bg text-warning-foreground",
  ordered: "bg-accent-200 text-accent-800",
  archived: "bg-muted text-muted-foreground",
};

export const CRM_RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  customer: "Ügyfél",
  supplier: "Beszállító",
  both: "Ügyfél / Beszállító",
};

export const CRM_QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Tervezet",
  approval_pending: "Jóváhagyás alatt",
  sent: "Kiküldve",
  accepted: "Elfogadva",
  rejected: "Elutasítva",
  expired: "Lejárt",
};

export const CRM_CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Tervezet",
  active: "Aktív",
  expired: "Lejárt",
  terminated: "Felmondott",
  archived: "Archivált",
};

export const CRM_COMMUNICATION_TYPE_LABELS: Record<string, string> = {
  phone: "Telefon",
  email: "E-mail",
  sms: "SMS",
  in_person: "Személyes találkozó",
  online_meeting: "Online meeting",
  other: "Egyéb",
};

export const CRM_TASK_STATUS_LABELS: Record<string, string> = {
  open: "Nyitott",
  in_progress: "Folyamatban",
  waiting: "Várakozik",
  done: "Kész",
};

export const CRM_TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Alacsony",
  normal: "Normál",
  high: "Magas",
  critical: "Kritikus",
};

export const CRM_CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-accent-100 text-accent-700",
  expired: "bg-warning-bg text-warning-foreground",
  terminated: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

export const DOCUMENTATION_SUBTYPE_LABELS: Record<string, string> = {
  contract: "Szerződés",
  purchase_order: "Megrendelés",
  completion_certificate: "Teljesítés igazolás",
  invoice: "Számla",
  plan: "Terv",
  letter_of_intent: "Szándéknyilatkozat",
};

export const VAT_TYPE_LABELS: Record<string, string> = {
  standard_27: "27% ÁFA",
  reduced_5: "5% ÁFA",
  reverse_charge: "Fordított ÁFA",
};

export const TIG_STATUS_LABELS: Record<string, string> = {
  draft: "Tervezet",
  pending_approval: "Jóváhagyás alatt",
  approved: "Jóváhagyott",
  invoiced: "Számlázott",
  closed: "Lezárt",
};

export const TIG_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-warning-bg text-warning-foreground",
  approved: "bg-accent-100 text-accent-700",
  invoiced: "bg-accent-200 text-accent-800",
  closed: "bg-muted text-muted-foreground",
};

export const SUBCONTRACTOR_INVOICE_STATUS_LABELS: Record<string, string> = {
  received: "Beérkezett",
  approved: "Jóváhagyott",
  awaiting_payment: "Kifizetésre vár",
  paid: "Kifizetett",
  overdue: "Lejárt",
};

export const SUBCONTRACTOR_INVOICE_STATUS_COLORS: Record<string, string> = {
  received: "bg-muted text-muted-foreground",
  approved: "bg-accent-100 text-accent-700",
  awaiting_payment: "bg-warning-bg text-warning-foreground",
  paid: "bg-accent-200 text-accent-800",
  overdue: "bg-destructive/10 text-destructive",
};

export const CUSTOMER_INVOICE_STATUS_LABELS: Record<string, string> = {
  issued: "Kiállított",
  partially_paid: "Részben kiegyenlített",
  paid: "Kiegyenlített",
  overdue: "Lejárt",
};

export const CUSTOMER_INVOICE_STATUS_COLORS: Record<string, string> = {
  issued: "bg-muted text-muted-foreground",
  partially_paid: "bg-warning-bg text-warning-foreground",
  paid: "bg-accent-200 text-accent-800",
  overdue: "bg-destructive/10 text-destructive",
};

export const SUBCONTRACTOR_CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Tervezet",
  active: "Aktív",
  completed: "Teljesített",
  cancelled: "Törölt",
};

export const DOCUMENT_FAMILY_LABELS: Record<string, string> = {
  tig: "Teljesítésigazolás",
  client_contract: "Ügyfél szerződés",
  subcontractor_contract: "Alvállalkozói szerződés",
};

export const TIG_DOCUMENT_SUBTYPE_LABELS: Record<string, string> = {
  normal: "Normál",
  helyesbito: "Helyesbítő / módosítási",
  potmunka: "Pótmunka",
  torlesi: "Törlési",
  utolagos: "Utólagos",
};

export const GENERATED_DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Generálás alatt",
  ready: "Kész",
  failed: "Sikertelen",
};

export const GENERATED_DOCUMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning-bg text-warning-foreground",
  ready: "bg-accent-200 text-accent-800",
  failed: "bg-destructive/10 text-destructive",
};

export const FINISH_LEVEL_LABELS: Record<string, string> = {
  economy: "Gazdaságos",
  standard: "Standard",
  premium: "Prémium",
};

export const WALL_TYPE_LABELS: Record<string, string> = {
  light_steel: "Könnyűszerkezet",
  clt: "CLT",
  timber_frame: "Faváz",
  brick: "Tégla",
};

export const ROOF_COVERING_LABELS: Record<string, string> = {
  tile: "Cserép",
  metal_sheet: "Trapézlemez",
  shingle: "Zsindely",
  flat_roof: "Lapostető szigetelés",
};

export const FOUNDATION_TYPE_LABELS: Record<string, string> = {
  strip: "Sávalap",
  slab: "Lemezalap",
  point: "Pontalap",
};

export const PRICE_CATALOG_SOURCE_LABELS: Record<string, string> = {
  own: "Saját",
  terc_import: "TERC import",
};

export const ROUGH_ESTIMATE_CATEGORY_LABELS: Record<string, string> = {
  earthwork_foundation: "Földmunka + alapozás",
  basement_wall: "Pinceszint (fal + szigetelés)",
  exterior_wall: "Külső teherhordó fal",
  interior_wall: "Belső válaszfal",
  walkable_slab: "Járható födém",
  light_slab: "Könnyű födém",
  roof_structure: "Tetőszerkezet",
  roof_covering: "Tetőhéjazat",
  openings: "Nyílászárók",
  mechanical: "Gépészet",
  electrical: "Villamosság",
  finishes: "Belső burkolat + festés",
};
