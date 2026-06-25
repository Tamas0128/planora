const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
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
}

export interface ProjectDetail extends ProjectCard {
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
  start_date?: string;
  end_date?: string;
  prep_date?: string;
  status: string;
  prerequisite_ids: number[];
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

export interface DashboardStats {
  overdue_tasks: number;
  upcoming_prep_7d: number;
  upcoming_prep_14d: number;
  slipping_projects: number;
  total_projects: number;
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
  return localStorage.getItem("planora_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("planora_refresh_token");
}

let meCache: Promise<User> | null = null;

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("planora_token", accessToken);
  localStorage.setItem("planora_refresh_token", refreshToken);
  meCache = null;
}

export function clearToken() {
  localStorage.removeItem("planora_token");
  localStorage.removeItem("planora_refresh_token");
  meCache = null;
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

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>("/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  // AppLayout and several pages each want the current user on mount; share
  // one in-flight/just-resolved request instead of firing /auth/me per page.
  me: () => {
    if (!meCache) {
      meCache = request<User>("/auth/me").catch((err) => {
        meCache = null;
        throw err;
      });
    }
    return meCache;
  },

  kanban: () => request<Record<string, ProjectCard[]>>("/projects/kanban"),

  projects: () => request<ProjectCard[]>("/projects"),

  project: (id: number) => request<ProjectDetail>(`/projects/${id}`),

  createProject: (data: Record<string, unknown>) =>
    request<ProjectDetail>("/projects", { method: "POST", body: JSON.stringify(data) }),

  updateProject: (id: number, data: Record<string, unknown>) =>
    request<ProjectDetail>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteProject: (id: number) =>
    request<{ ok: boolean; deleted: string }>(`/projects/${id}`, { method: "DELETE" }),

  activities: (projectId: number) => request<Activity[]>(`/projects/${projectId}/activities`),

  updateActivity: (projectId: number, activityId: number, data: Record<string, unknown>) =>
    request<Activity>(`/projects/${projectId}/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
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
};

export const STATUS_LABELS: Record<string, string> = {
  planning: "Tervezés alatt",
  foundation: "Alapozás",
  structure: "Szerkezetállítás",
  exterior_done: "Kívülről kész",
  turnkey: "Kulcsrakész",
};

export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-slate-500",
  foundation: "bg-amber-500",
  structure: "bg-orange-500",
  exterior_done: "bg-violet-500",
  turnkey: "bg-emerald-500",
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
};
