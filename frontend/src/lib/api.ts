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
  latitude?: number;
  longitude?: number;
}

export interface ProjectDetail extends ProjectCard {
  delay_risk: string;
  delay_risk_reason: string;
  address: string;
  lot_number?: string;
  client_phone?: string;
  client_email?: string;
  project_manager_id?: number;
  site_manager_id?: number;
  procurement_id?: number;
  procurement_name?: string;
  billing_id?: number;
  billing_name?: string;
  subcontractors?: string;
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
    throw new Error(err.detail || "Request failed");
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
    throw new Error(err.detail || "Letöltés sikertelen");
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
};

export const STATUS_LABELS: Record<string, string> = {
  planning: "Tervezés alatt",
  foundation: "Alapozás",
  structure: "Szerkezetállítás",
  exterior_done: "Kívülről kész",
  turnkey: "Kulcsrakész",
};

export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-accent-300",
  foundation: "bg-accent-400",
  structure: "bg-accent-500",
  exterior_done: "bg-accent-600",
  turnkey: "bg-accent-700",
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

export const DOCUMENTATION_SUBTYPE_LABELS: Record<string, string> = {
  contract: "Szerződés",
  purchase_order: "Megrendelés",
  completion_certificate: "Teljesítés igazolás",
  invoice: "Számla",
  plan: "Terv",
  letter_of_intent: "Szándéknyilatkozat",
};
