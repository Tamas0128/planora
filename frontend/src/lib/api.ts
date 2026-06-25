const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

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
  procurement_id?: number;
  billing_id?: number;
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

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("planora_token");
}

export function setToken(token: string) {
  localStorage.setItem("planora_token", token);
}

export function clearToken() {
  localStorage.removeItem("planora_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
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

  me: () => request<User>("/auth/me"),

  kanban: () => request<Record<string, ProjectCard[]>>("/projects/kanban"),

  projects: () => request<ProjectCard[]>("/projects"),

  project: (id: number) => request<ProjectDetail>(`/projects/${id}`),

  createProject: (data: Record<string, unknown>) =>
    request<ProjectDetail>("/projects", { method: "POST", body: JSON.stringify(data) }),

  updateProject: (id: number, data: Record<string, unknown>) =>
    request<ProjectDetail>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

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
