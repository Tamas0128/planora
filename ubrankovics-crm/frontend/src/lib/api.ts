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

export interface UgyfelProjektLink {
  id: number;
  projekt_id: number;
  projekt_nev: string;
  allapot: string;
  epitesi_cim?: string | null;
  szerep?: string | null;
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

export interface AlvallalkozoTetel {
  vallalas_id: number;
  tetel_id: number;
  munkanem_nev: string;
  projekt_id: number;
  projekt_nev: string;
  szakasz: string;
}

export interface SzemelyProjektSzerep {
  projekt_id: number;
  projekt_nev: string;
  szerep: string;
}

export interface SzemelyTetel {
  tetel_id: number;
  munkanem_nev: string;
  projekt_id: number;
  projekt_nev: string;
  szakasz: string;
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

export interface Feladat {
  id: number;
  cim: string;
  leiras?: string | null;
  hatarido?: string | null;
  felelos_id?: number | null;
  felelos?: UserBrief | null;
  projekt_id?: number | null;
  projekt_nev?: string | null;
  letrehozo_id: number;
  kesz: boolean;
  created_at: string;
}

export interface SzakaszMegoszlasItem {
  szakasz: string;
  tetel_szam: number;
  ertek_osszesen: string;
}

export interface LejartSzamlaItem {
  forras_tipus: string;
  forras_id: number;
  projekt_id: number;
  projekt_nev: string;
  partner_nev: string;
  szamlaszam: string;
  esedekesseg: string;
  hatralek: string;
}

export interface PenzugyiOsszesito {
  lejart_szamlak: LejartSzamlaItem[];
  lejart_bevetel_osszesen: string;
  lejart_kiadas_osszesen: string;
  legutobbi_bankegyenleg_datuma?: string | null;
  legutobbi_bankegyenleg?: string | null;
}

export interface ProjektDetail extends ProjektListItem {
  hrsz?: string | null;
  enaplo_iktatoszam?: string | null;
  mappa_utvonal?: string | null;
  delivery_date?: string | null;
  completion_percent: string;
  projekt_tipus_id?: number | null;
  ugyfel_linkek: ProjektUgyfelLink[];
  szerepek: ProjektSzerep[];
}

export interface ProjektTipusLepesSablon {
  id: number;
  nev: string;
  sorrend: number;
  merfoldko: boolean;
}

export interface ProjektTipusFazisSablon {
  id: number;
  nev: string;
  sorrend: number;
  lepesek: ProjektTipusLepesSablon[];
}

export interface ProjektTipus {
  id: number;
  nev: string;
  fazisok: ProjektTipusFazisSablon[];
}

export interface ProjektLepes {
  id: number;
  nev: string;
  sorrend: number;
  merfoldko: boolean;
  kesz: boolean;
  datum?: string | null;
}

export interface ProjektFazis {
  id: number;
  nev: string;
  sorrend: number;
  lepesek: ProjektLepes[];
}

export interface SablonElonezet {
  targy: string;
  html: string;
}

export interface KikuldottEmail {
  id: number;
  tipus: string;
  cimzett: string;
  targy: string;
  tetel_ids?: string | null;
  uzenet?: string | null;
  elkuldve_at: string;
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

export interface TetelFuggoseg {
  id: number;
  prerequisite_id: number;
  prerequisite_nev: string;
}

export interface BeszallitoiAjanlat {
  id: number;
  netto: string;
  afa_tipus: string;
  afa: string;
  brutto: string;
  ervenyesseg_datum?: string | null;
  szallitasi_ido_nap?: number | null;
  megjegyzes?: string | null;
}

export interface Ajanlatkeres {
  id: number;
  cimzett_nev: string;
  cimzett_email?: string | null;
  alvallalkozo_id?: number | null;
  kuldes_datum?: string | null;
  hatarido?: string | null;
  allapot: string;
  ajanlatok: BeszallitoiAjanlat[];
}

export interface Dokumentum {
  id: number;
  tipus: string;
  eredeti_nev?: string | null;
  tartalom_tipus?: string | null;
  meret?: number | null;
  feltoltotte_id?: number | null;
  megjegyzes?: string | null;
  created_at: string;
}

export interface AnyagRendeles {
  id: number;
  megnevezes: string;
  beszallito?: string | null;
  mennyiseg?: string | null;
  mertekegyseg?: string | null;
  felelos_id?: number | null;
  szukseges_datum?: string | null;
  allapot: string;
  kivalasztott_ajanlat_id?: number | null;
  beszerzesi_brutto?: string | null;
  megrendeles_datum?: string | null;
  visszaigazolt_datum?: string | null;
  tenyleges_erkezes?: string | null;
  atvett_mennyiseg?: string | null;
  eltere_megjegyzes?: string | null;
  po_szam?: string | null;
  jovahagyva: boolean;
  jovahagyas_datum?: string | null;
  szamla_szam?: string | null;
  szamla_allapot: string;
  szamla_osszeg?: string | null;
  ugyfel_netto?: string | null;
  ugyfel_afa_tipus?: string | null;
  ugyfel_afa?: string | null;
  ugyfel_brutto?: string | null;
  megjegyzes?: string | null;
  ajanlatkeresek: Ajanlatkeres[];
}

export interface ProjektTetel {
  id: number;
  munkanem_id: number;
  munkanem: Munkanem;
  sorrend: number;
  felelos_szerep?: string | null;
  kijelolt_id?: number | null;
  kijelolt?: Szemely | null;
  info?: string | null;
  extra_megjegyzes?: string | null;
  potmunka: boolean;
  potmunka_osszeg?: string | null;
  tig?: string | null;
  varhato_szoveg?: string | null;
  varhato_datum?: string | null;
  szakasz: string;
  duration_days?: number | null;
  prep_days: number;
  start_date?: string | null;
  end_date?: string | null;
  prep_date?: string | null;
  terv_kezdes?: string | null;
  terv_befejezes?: string | null;
  tenyleges_kezdes?: string | null;
  tenyleges_befejezes?: string | null;
  vallalasok: Vallalas[];
  esemenyek: TetelEsemeny[];
  specifikaciok: Specifikacio[];
  fuggosegek: TetelFuggoseg[];
  rendelesek: AnyagRendeles[];
}

export interface Tig {
  id: number;
  projekt_id: number;
  alvallalkozo_id: number;
  alvallalkozo: Alvallalkozo;
  datum: string;
  idoszak_kezdet: string;
  idoszak_veg: string;
  netto: string;
  afa_tipus: string;
  afa: string;
  brutto: string;
  allapot: string;
  megjegyzes?: string | null;
  created_at: string;
}

export interface AlvallalkozoiSzamla {
  id: number;
  projekt_id: number;
  alvallalkozo_id: number;
  alvallalkozo: Alvallalkozo;
  tig_id?: number | null;
  szamlaszam: string;
  teljesites_datum: string;
  kiallitas_datum: string;
  esedekesseg: string;
  fizetes_datum?: string | null;
  netto: string;
  afa_tipus: string;
  afa: string;
  brutto: string;
  fizetett_osszeg?: string | null;
  hatralek: string;
  allapot: string;
  megjegyzes?: string | null;
  created_at: string;
}

export interface SzerzodesReszlet {
  id: number;
  megnevezes: string;
  osszeg: string;
  esedekesseg: string;
  kiallitott_szamla_id?: number | null;
}

export interface Szerzodes {
  id: number;
  projekt_id: number;
  ugyfel_id: number;
  ugyfel: Ugyfel;
  szerzodesszam: string;
  osszeg: string;
  afa_tipus: string;
  kezdes: string;
  befejezes: string;
  allapot: string;
  megjegyzes?: string | null;
  created_at: string;
  reszletek: SzerzodesReszlet[];
}

export interface UgyfelSzamla {
  id: number;
  projekt_id: number;
  ugyfel_id: number;
  ugyfel: Ugyfel;
  szerzodes_id?: number | null;
  szamlaszam: string;
  kiallitas_datum: string;
  teljesites_datum: string;
  esedekesseg: string;
  fizetes_datum?: string | null;
  netto: string;
  afa_tipus: string;
  afa: string;
  brutto: string;
  fizetett_osszeg?: string | null;
  hatralek: string;
  allapot: string;
  megjegyzes?: string | null;
  created_at: string;
}

export interface TervezettBerkoltseg {
  id: number;
  honap: string;
  osszeg: string;
  megjegyzes?: string | null;
}

export interface BankEgyenleg {
  id: number;
  datum: string;
  egyenleg: string;
  rogzitette_id?: number | null;
  created_at: string;
}

export interface CashflowItem {
  irany: string;
  reteg: string;
  leiras: string;
  osszeg: string;
  esedekesseg: string;
  lejart: boolean;
  forras_tipus: string;
  forras_id: number;
  projekt_id?: number | null;
}

export interface CashflowBucket {
  kezdo_datum: string;
  vege_datum: string;
  nyito: string;
  bevetel_teny: string;
  bevetel_terv: string;
  kiadas_teny: string;
  kiadas_terv: string;
  netto: string;
  zaro: string;
  negativ: boolean;
}

export interface CashflowRolling {
  bucket_meret: string;
  horizont: number;
  nyito_egyenleg_datuma?: string | null;
  bucketek: CashflowBucket[];
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

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) {
    let detail = "Letöltés sikertelen";
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
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
  async login(username: string, password: string): Promise<TokenResponse> {
    return request("/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  me: () => request<UserResponse>("/auth/me"),
  usersDirectory: () => request<UserBrief[]>("/auth/users/directory"),
  listUsers: () => request<UserResponse[]>("/auth/users"),
  createUser: (body: { username: string; email: string; full_name: string; password: string; role: string }) =>
    request<UserResponse>("/auth/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: number, body: Record<string, unknown>) =>
    request<UserResponse>(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listUgyfelek: (q?: string) => request<Ugyfel[]>(`/ugyfelek${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getUgyfel: (id: number) => request<Ugyfel>(`/ugyfelek/${id}`),
  createUgyfel: (body: Partial<Ugyfel>) =>
    request<Ugyfel>("/ugyfelek", { method: "POST", body: JSON.stringify(body) }),
  updateUgyfel: (id: number, body: Partial<Ugyfel>) =>
    request<Ugyfel>(`/ugyfelek/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUgyfel: (id: number) => request<void>(`/ugyfelek/${id}`, { method: "DELETE" }),
  listUgyfelProjektek: (id: number) => request<UgyfelProjektLink[]>(`/ugyfelek/${id}/projektek`),

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

  addFuggoseg: (projektId: number, tetelId: number, prerequisiteId: number) =>
    request<TetelFuggoseg>(`/projektek/${projektId}/tetelek/${tetelId}/fuggosegek`, {
      method: "POST",
      body: JSON.stringify({ prerequisite_id: prerequisiteId }),
    }),
  removeFuggoseg: (projektId: number, tetelId: number, fuggosegId: number) =>
    request<void>(`/projektek/${projektId}/tetelek/${tetelId}/fuggosegek/${fuggosegId}`, {
      method: "DELETE",
    }),
  recalculateUtemezes: (projektId: number) =>
    request<ProjektTetel[]>(`/projektek/${projektId}/utemezes/recalculate`, { method: "POST" }),

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

  addRendeles: (projektId: number, tetelId: number, body: Record<string, unknown>) =>
    request<AnyagRendeles>(`/projektek/${projektId}/tetelek/${tetelId}/rendelesek`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRendeles: (projektId: number, tetelId: number, rendelesId: number, body: Record<string, unknown>) =>
    request<AnyagRendeles>(`/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeRendeles: (projektId: number, tetelId: number, rendelesId: number) =>
    request<void>(`/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}`, {
      method: "DELETE",
    }),

  addAjanlatkeres: (projektId: number, tetelId: number, rendelesId: number, body: Record<string, unknown>) =>
    request<Ajanlatkeres>(
      `/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}/ajanlatkeresek`,
      { method: "POST", body: JSON.stringify(body) }
    ),
  updateAjanlatkeres: (
    projektId: number,
    tetelId: number,
    rendelesId: number,
    ajanlatkeresId: number,
    body: Record<string, unknown>
  ) =>
    request<Ajanlatkeres>(
      `/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}/ajanlatkeresek/${ajanlatkeresId}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
  removeAjanlatkeres: (projektId: number, tetelId: number, rendelesId: number, ajanlatkeresId: number) =>
    request<void>(
      `/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}/ajanlatkeresek/${ajanlatkeresId}`,
      { method: "DELETE" }
    ),

  addBeszallitoiAjanlat: (
    projektId: number,
    tetelId: number,
    rendelesId: number,
    ajanlatkeresId: number,
    body: Record<string, unknown>
  ) =>
    request<BeszallitoiAjanlat>(
      `/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}/ajanlatkeresek/${ajanlatkeresId}/ajanlatok`,
      { method: "POST", body: JSON.stringify(body) }
    ),
  removeBeszallitoiAjanlat: (
    projektId: number,
    tetelId: number,
    rendelesId: number,
    ajanlatkeresId: number,
    ajanlatId: number
  ) =>
    request<void>(
      `/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}/ajanlatkeresek/${ajanlatkeresId}/ajanlatok/${ajanlatId}`,
      { method: "DELETE" }
    ),

  valasztAjanlat: (projektId: number, tetelId: number, rendelesId: number, ajanlatId: number) =>
    request<AnyagRendeles>(
      `/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}/valaszt-ajanlat`,
      { method: "POST", body: JSON.stringify({ ajanlat_id: ajanlatId }) }
    ),
  setUgyfelAr: (
    projektId: number,
    tetelId: number,
    rendelesId: number,
    body: { ugyfel_netto: string; ugyfel_afa_tipus: string }
  ) =>
    request<AnyagRendeles>(
      `/projektek/${projektId}/tetelek/${tetelId}/rendelesek/${rendelesId}/ugyfel-ar`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),

  listProjektTipusok: () => request<ProjektTipus[]>("/projekt-tipusok"),

  sablonElonezet: (projektId: number, body: { tipus: string; tetel_ids: number[]; uzenet?: string | null }) =>
    request<SablonElonezet>(`/projektek/${projektId}/sablon-elonezet`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  kuldEmail: (
    projektId: number,
    body: { tipus: string; tetel_ids: number[]; cimzett: string; targy?: string | null; uzenet?: string | null }
  ) =>
    request<KikuldottEmail>(`/projektek/${projektId}/email`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listKikuldottEmailek: (projektId: number) => request<KikuldottEmail[]>(`/projektek/${projektId}/emailek`),

  listFazisok: (projektId: number) => request<ProjektFazis[]>(`/projektek/${projektId}/fazisok`),
  addFazis: (projektId: number, nev: string) =>
    request<ProjektFazis>(`/projektek/${projektId}/fazisok`, {
      method: "POST",
      body: JSON.stringify({ nev }),
    }),
  removeFazis: (projektId: number, fazisId: number) =>
    request<void>(`/projektek/${projektId}/fazisok/${fazisId}`, { method: "DELETE" }),
  addLepes: (projektId: number, fazisId: number, body: Record<string, unknown>) =>
    request<ProjektLepes>(`/projektek/${projektId}/fazisok/${fazisId}/lepesek`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLepes: (projektId: number, fazisId: number, lepesId: number, body: Record<string, unknown>) =>
    request<ProjektLepes>(`/projektek/${projektId}/fazisok/${fazisId}/lepesek/${lepesId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeLepes: (projektId: number, fazisId: number, lepesId: number) =>
    request<void>(`/projektek/${projektId}/fazisok/${fazisId}/lepesek/${lepesId}`, {
      method: "DELETE",
    }),

  listDokumentumok: (projektId: number) => request<Dokumentum[]>(`/projektek/${projektId}/dokumentumok`),
  uploadDokumentum: (projektId: number, body: { tipus: string; megjegyzes?: string; file: File }) => {
    const form = new FormData();
    form.set("tipus", body.tipus);
    if (body.megjegyzes) form.set("megjegyzes", body.megjegyzes);
    form.set("file", body.file);
    return request<Dokumentum>(`/projektek/${projektId}/dokumentumok`, { method: "POST", body: form });
  },
  downloadDokumentum: (projektId: number, dokumentumId: number, filename: string) =>
    downloadFile(`/projektek/${projektId}/dokumentumok/${dokumentumId}/letoltes`, filename),
  deleteDokumentum: (projektId: number, dokumentumId: number) =>
    request<void>(`/projektek/${projektId}/dokumentumok/${dokumentumId}`, { method: "DELETE" }),

  listFeladatok: (params?: { felelos_id?: number; projekt_id?: number; kesz?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.felelos_id !== undefined) q.set("felelos_id", String(params.felelos_id));
    if (params?.projekt_id !== undefined) q.set("projekt_id", String(params.projekt_id));
    if (params?.kesz !== undefined) q.set("kesz", String(params.kesz));
    const qs = q.toString();
    return request<Feladat[]>(`/feladatok${qs ? `?${qs}` : ""}`);
  },
  createFeladat: (body: Record<string, unknown>) =>
    request<Feladat>("/feladatok", { method: "POST", body: JSON.stringify(body) }),
  updateFeladat: (id: number, body: Record<string, unknown>) =>
    request<Feladat>(`/feladatok/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteFeladat: (id: number) => request<void>(`/feladatok/${id}`, { method: "DELETE" }),

  getErtekesitesiAllapot: () => request<SzakaszMegoszlasItem[]>("/riportok/ertekesitesi-allapot"),
  getPenzugyiOsszesito: () => request<PenzugyiOsszesito>("/riportok/penzugyi-osszesito"),

  listMunkanemek: () => request<Munkanem[]>("/munkanemek"),
  listAlvallalkozok: () => request<Alvallalkozo[]>("/alvallalkozok"),
  createAlvallalkozo: (body: Partial<Alvallalkozo>) =>
    request<Alvallalkozo>("/alvallalkozok", { method: "POST", body: JSON.stringify(body) }),
  getAlvallalkozo: (id: number) => request<Alvallalkozo>(`/alvallalkozok/${id}`),
  updateAlvallalkozo: (id: number, body: Partial<Alvallalkozo>) =>
    request<Alvallalkozo>(`/alvallalkozok/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAlvallalkozo: (id: number) => request<void>(`/alvallalkozok/${id}`, { method: "DELETE" }),
  listAlvallalkozoTetelek: (id: number) => request<AlvallalkozoTetel[]>(`/alvallalkozok/${id}/tetelek`),
  listAlvallalkozoTig: (id: number) => request<Tig[]>(`/alvallalkozok/${id}/tig`),
  listAlvallalkozoSzamlak: (id: number) => request<AlvallalkozoiSzamla[]>(`/alvallalkozok/${id}/szamlak`),

  listSzemelyek: () => request<Szemely[]>("/szemelyek"),
  createSzemely: (body: Partial<Szemely>) =>
    request<Szemely>("/szemelyek", { method: "POST", body: JSON.stringify(body) }),
  getSzemely: (id: number) => request<Szemely>(`/szemelyek/${id}`),
  updateSzemely: (id: number, body: Partial<Szemely>) =>
    request<Szemely>(`/szemelyek/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSzemely: (id: number) => request<void>(`/szemelyek/${id}`, { method: "DELETE" }),
  listSzemelySzerepek: (id: number) => request<SzemelyProjektSzerep[]>(`/szemelyek/${id}/szerepek`),
  listSzemelyTetelek: (id: number) => request<SzemelyTetel[]>(`/szemelyek/${id}/tetelek`),
  listTorzsadatok: (tipus?: string) =>
    request<Torzsadat[]>(`/torzsadatok${tipus ? `?tipus=${encodeURIComponent(tipus)}` : ""}`),
  createTorzsadat: (body: Partial<Torzsadat>) =>
    request<Torzsadat>("/torzsadatok", { method: "POST", body: JSON.stringify(body) }),

  listTig: (projektId: number) => request<Tig[]>(`/projektek/${projektId}/tig`),
  createTig: (projektId: number, body: Record<string, unknown>) =>
    request<Tig>(`/projektek/${projektId}/tig`, { method: "POST", body: JSON.stringify(body) }),
  updateTig: (projektId: number, tigId: number, body: Record<string, unknown>) =>
    request<Tig>(`/projektek/${projektId}/tig/${tigId}`, { method: "PATCH", body: JSON.stringify(body) }),

  listAlvallalkozoiSzamla: (projektId: number) =>
    request<AlvallalkozoiSzamla[]>(`/projektek/${projektId}/alvallalkozoi-szamlak`),
  createAlvallalkozoiSzamla: (projektId: number, body: Record<string, unknown>) =>
    request<AlvallalkozoiSzamla>(`/projektek/${projektId}/alvallalkozoi-szamlak`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAlvallalkozoiSzamla: (projektId: number, szamlaId: number, body: Record<string, unknown>) =>
    request<AlvallalkozoiSzamla>(`/projektek/${projektId}/alvallalkozoi-szamlak/${szamlaId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listSzerzodesek: (projektId: number) => request<Szerzodes[]>(`/projektek/${projektId}/szerzodesek`),
  createSzerzodes: (projektId: number, body: Record<string, unknown>) =>
    request<Szerzodes>(`/projektek/${projektId}/szerzodesek`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSzerzodes: (projektId: number, szerzodesId: number, body: Record<string, unknown>) =>
    request<Szerzodes>(`/projektek/${projektId}/szerzodesek/${szerzodesId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  kiallitSzamlaReszletbol: (
    projektId: number,
    szerzodesId: number,
    reszletId: number,
    body: Record<string, unknown>
  ) =>
    request<UgyfelSzamla>(
      `/projektek/${projektId}/szerzodesek/${szerzodesId}/reszletek/${reszletId}/szamla-kiallitas`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  listUgyfelSzamla: (projektId: number) => request<UgyfelSzamla[]>(`/projektek/${projektId}/ugyfel-szamlak`),
  createUgyfelSzamla: (projektId: number, body: Record<string, unknown>) =>
    request<UgyfelSzamla>(`/projektek/${projektId}/ugyfel-szamlak`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateUgyfelSzamla: (projektId: number, szamlaId: number, body: Record<string, unknown>) =>
    request<UgyfelSzamla>(`/projektek/${projektId}/ugyfel-szamlak/${szamlaId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listBerkoltsegek: () => request<TervezettBerkoltseg[]>("/berkoltsegek"),
  createBerkoltseg: (body: Record<string, unknown>) =>
    request<TervezettBerkoltseg>("/berkoltsegek", { method: "POST", body: JSON.stringify(body) }),
  updateBerkoltseg: (id: number, body: Record<string, unknown>) =>
    request<TervezettBerkoltseg>(`/berkoltsegek/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listBankegyenleg: () => request<BankEgyenleg[]>("/cashflow/bankegyenleg"),
  createBankegyenleg: (body: Record<string, unknown>) =>
    request<BankEgyenleg>("/cashflow/bankegyenleg", { method: "POST", body: JSON.stringify(body) }),

  getRollingCashflow: (params: { bucket?: string; horizon?: number; projekt_id?: number }) => {
    const q = new URLSearchParams();
    if (params.bucket) q.set("bucket", params.bucket);
    if (params.horizon) q.set("horizon", String(params.horizon));
    if (params.projekt_id) q.set("projekt_id", String(params.projekt_id));
    return request<CashflowRolling>(`/cashflow/rolling?${q.toString()}`);
  },
  getRollingCashflowItems: (params: {
    bucket?: string;
    horizon?: number;
    projekt_id?: number;
    kezdo_datum: string;
  }) => {
    const q = new URLSearchParams();
    if (params.bucket) q.set("bucket", params.bucket);
    if (params.horizon) q.set("horizon", String(params.horizon));
    if (params.projekt_id) q.set("projekt_id", String(params.projekt_id));
    q.set("kezdo_datum", params.kezdo_datum);
    return request<CashflowItem[]>(`/cashflow/rolling/items?${q.toString()}`);
  },
};
