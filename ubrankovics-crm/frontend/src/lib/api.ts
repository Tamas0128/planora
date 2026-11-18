const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface UserBrief {
  id: number;
  full_name: string;
  role: string;
}

export interface UserResponse extends UserBrief {
  username: string;
  email: string;
  is_active: boolean;
}

export interface Ugyfel {
  id: number;
  nev: string;
  telefon?: string | null;
  email?: string | null;
  owner_id?: number | null;
  created_at: string;
}

export interface Munkanem {
  id: number;
  kod: string;
  nev: string;
  csoport: string;
  sorrend: number;
  alias?: string | null;
}

export interface Alvallalkozo {
  id: number;
  nev: string;
  kapcsolat?: string | null;
}

export interface Szemely {
  id: number;
  nev: string;
  telefon?: string | null;
  email?: string | null;
  szervezet: string;
}

export interface Torzsadat {
  id: number;
  tipus: string;
  ertek: string;
}

export interface ProjektUgyfelLink {
  id: number;
  ugyfel_id: number;
  epitesi_cim?: string | null;
  szerep?: string | null;
  ugyfel: Ugyfel;
}

export interface ProjektSzerep {
  id: number;
  szemely_id: number;
  szerep: string;
  szemely: Szemely;
}

export interface ProjektListItem {
  id: number;
  projekt_nev: string;
  allapot: string;
  utemezes_aktiv: boolean;
  created_at: string;
}

export interface ProjektDetail extends ProjektListItem {
  hrsz?: string | null;
  enaplo_iktatoszam?: string | null;
  mappa_utvonal?: string | null;
  delivery_date?: string | null;
  ugyfel_linkek: ProjektUgyfelLink[];
  szerepek: ProjektSzerep[];
}

export interface Vallalas {
  id: number;
  tipus: string;
  alvallalkozo_id?: number | null;
  alvallalkozo?: Alvallalkozo | null;
}

export interface TetelEsemeny {
  id: number;
  tipus: string;
  allapot: string;
  datum?: string | null;
  megjegyzes?: string | null;
  created_at: string;
}

export interface Specifikacio {
  id: number;
  csoport?: string | null;
  kulcs: string;
  ertek: string;
  mertekegyseg?: string | null;
  megjegyzes?: string | null;
  torzs_kod_id?: number | null;
}

export interface ProjektTetel {
  id: number;
  munkanem_id: number;
  munkanem: Munkanem;
  info?: string | null;
  extra_megjegyzes?: string | null;
  potmunka: boolean;
  potmunka_osszeg?: string | null;
  tig?: string | null;
  varhato_szoveg?: string | null;
  varhato_datum?: string | null;
  szakasz: string;
  beszallito?: string | null;
  rendeles_hatarido?: string | null;
  vallalasok: Vallalas[];
  esemenyek: TetelEsemeny[];
  specifikaciok: Specifikacio[];
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

if (typeof window !== "undefined") {
  accessToken = localStorage.getItem("access_token");
  refreshToken = localStorage.getItem("refresh_token");
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }
}

export function isLoggedIn() {
  return !!accessToken;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData) && options.body) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && refreshToken) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    if (await refreshPromise) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } else {
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Nincs bejelentkezve");
    }
  }

  if (!res.ok) {
    let detail = `Hiba (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  async login(username: string, password: string): Promise<TokenResponse> {
    return request("/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  me: () => request<UserResponse>("/auth/me"),
  usersDirectory: () => request<UserBrief[]>("/auth/users/directory"),

  listUgyfelek: (q?: string) => request<Ugyfel[]>(`/ugyfelek${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getUgyfel: (id: number) => request<Ugyfel>(`/ugyfelek/${id}`),
  createUgyfel: (body: Partial<Ugyfel>) =>
    request<Ugyfel>("/ugyfelek", { method: "POST", body: JSON.stringify(body) }),
  updateUgyfel: (id: number, body: Partial<Ugyfel>) =>
    request<Ugyfel>(`/ugyfelek/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUgyfel: (id: number) => request<void>(`/ugyfelek/${id}`, { method: "DELETE" }),

  listProjektek: () => request<ProjektListItem[]>("/projektek"),
  getProjekt: (id: number) => request<ProjektDetail>(`/projektek/${id}`),
  createProjekt: (body: Record<string, unknown>) =>
    request<ProjektDetail>("/projektek", { method: "POST", body: JSON.stringify(body) }),
  updateProjekt: (id: number, body: Record<string, unknown>) =>
    request<ProjektDetail>(`/projektek/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProjekt: (id: number) => request<void>(`/projektek/${id}`, { method: "DELETE" }),
  addProjektUgyfel: (projektId: number, body: Record<string, unknown>) =>
    request<ProjektUgyfelLink>(`/projektek/${projektId}/ugyfelek`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeProjektUgyfel: (projektId: number, linkId: number) =>
    request<void>(`/projektek/${projektId}/ugyfelek/${linkId}`, { method: "DELETE" }),
  addProjektSzerep: (projektId: number, body: Record<string, unknown>) =>
    request<ProjektSzerep>(`/projektek/${projektId}/szerepek`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeProjektSzerep: (projektId: number, szerepId: number) =>
    request<void>(`/projektek/${projektId}/szerepek/${szerepId}`, { method: "DELETE" }),

  listTetelek: (projektId: number) => request<ProjektTetel[]>(`/projektek/${projektId}/tetelek`),
  createTetel: (projektId: number, body: Record<string, unknown>) =>
    request<ProjektTetel>(`/projektek/${projektId}/tetelek`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTetel: (projektId: number, tetelId: number, body: Record<string, unknown>) =>
    request<ProjektTetel>(`/projektek/${projektId}/tetelek/${tetelId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTetel: (projektId: number, tetelId: number) =>
    request<void>(`/projektek/${projektId}/tetelek/${tetelId}`, { method: "DELETE" }),

  addVallalas: (projektId: number, tetelId: number, body: Record<string, unknown>) =>
    request<Vallalas>(`/projektek/${projektId}/tetelek/${tetelId}/vallalasok`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeVallalas: (projektId: number, tetelId: number, vallalasId: number) =>
    request<void>(`/projektek/${projektId}/tetelek/${tetelId}/vallalasok/${vallalasId}`, {
      method: "DELETE",
    }),

  addEsemeny: (projektId: number, tetelId: number, body: Record<string, unknown>) =>
    request<TetelEsemeny>(`/projektek/${projektId}/tetelek/${tetelId}/esemenyek`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEsemeny: (projektId: number, tetelId: number, esemenyId: number, body: Record<string, unknown>) =>
    request<TetelEsemeny>(`/projektek/${projektId}/tetelek/${tetelId}/esemenyek/${esemenyId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeEsemeny: (projektId: number, tetelId: number, esemenyId: number) =>
    request<void>(`/projektek/${projektId}/tetelek/${tetelId}/esemenyek/${esemenyId}`, {
      method: "DELETE",
    }),

  addSpecifikacio: (projektId: number, tetelId: number, body: Record<string, unknown>) =>
    request<Specifikacio>(`/projektek/${projektId}/tetelek/${tetelId}/specifikaciok`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeSpecifikacio: (projektId: number, tetelId: number, specId: number) =>
    request<void>(`/projektek/${projektId}/tetelek/${tetelId}/specifikaciok/${specId}`, {
      method: "DELETE",
    }),

  listMunkanemek: () => request<Munkanem[]>("/munkanemek"),
  listAlvallalkozok: () => request<Alvallalkozo[]>("/alvallalkozok"),
  createAlvallalkozo: (body: Partial<Alvallalkozo>) =>
    request<Alvallalkozo>("/alvallalkozok", { method: "POST", body: JSON.stringify(body) }),
  listSzemelyek: () => request<Szemely[]>("/szemelyek"),
  createSzemely: (body: Partial<Szemely>) =>
    request<Szemely>("/szemelyek", { method: "POST", body: JSON.stringify(body) }),
  listTorzsadatok: (tipus?: string) =>
    request<Torzsadat[]>(`/torzsadatok${tipus ? `?tipus=${encodeURIComponent(tipus)}` : ""}`),
  createTorzsadat: (body: Partial<Torzsadat>) =>
    request<Torzsadat>("/torzsadatok", { method: "POST", body: JSON.stringify(body) }),
};
