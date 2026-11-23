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

export interface KeresesResult {
  tipus: string; // "ugyfel" | "projekt" | "alvallalkozo" | "szemely"
  id: number;
  cim: string;
  alcim?: string | null;
}

export interface UserResponse extends UserBrief {
  totp_enabled?: boolean;
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
  leiratkozott?: boolean;
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

export type ErdeklodesAllapot = "uj" | "kapcsolatfelvetel" | "ajanlat" | "targyalas" | "nyert" | "elveszett";

export interface Erdeklodes {
  id: number;
  nev: string;
  telefon?: string | null;
  email?: string | null;
  forras?: string | null;
  varhato_lezaras?: string | null;
  allapot: ErdeklodesAllapot;
  becsult_ertek?: string | null;
  megjegyzes?: string | null;
  owner_id?: number | null;
  owner?: UserBrief | null;
  ugyfel_id?: number | null;
  created_at: string;
}

export interface PipelineSzakasz {
  allapot: ErdeklodesAllapot;
  darab: number;
  ertek_osszesen: string;
}

export type KommunikacioTipus = "hivas" | "email" | "talalkozo" | "megjegyzes";

export interface Kommunikacio {
  id: number;
  ugyfel_id?: number | null;
  erdeklodes_id?: number | null;
  tipus: KommunikacioTipus;
  datum: string;
  tartalom: string;
  user?: UserBrief | null;
}

export interface ErtesitesItem {
  tipus: string;
  szint: string; // "lejart" | "kozeli"
  cim: string;
  reszlet?: string | null;
  datum?: string | null;
  link: string;
}

export interface UgyfelImportValasz {
  letrehozva: number;
  kihagyva_duplikatum: number;
  hibas_sorok: string[];
}

export interface UgyfelDuplikatumCsoport {
  ok: string;
  ugyfelek: Ugyfel[];
}

export interface AuditNaploItem {
  id: number;
  user?: UserBrief | null;
  entitas: string;
  entitas_id?: number | null;
  muvelet: string;
  reszletek?: string | null;
  created_at: string;
}

export interface EgyediMezo {
  id: number;
  entitas: string;
  nev: string;
  tipus: string; // szoveg | szam | datum
  sorrend: number;
}

export interface EgyediMezoErtek {
  mezo_id: number;
  nev: string;
  tipus: string;
  ertek?: string | null;
}

export interface Cimke {
  id: number;
  nev: string;
  ugyfel_szam: number;
}

export interface Kampany {
  id: number;
  nev: string;
  targy: string;
  uzenet: string;
  cimke_id?: number | null;
  cimke_nev?: string | null;
  cimzettek_szama: number;
  elkuldve_szama: number;
  created_at: string;
}

export type JegyAllapot = "nyitott" | "folyamatban" | "megoldva" | "lezart";
export type JegyPrioritas = "alacsony" | "normal" | "surgos";

export interface Jegy {
  id: number;
  ugyfel_id: number;
  ugyfel_nev?: string | null;
  projekt_id?: number | null;
  targy: string;
  leiras?: string | null;
  allapot: JegyAllapot;
  prioritas: JegyPrioritas;
  felelos_id?: number | null;
  felelos?: UserBrief | null;
  created_at: string;
  lezarva_at?: string | null;
}

export interface ElorejelzesHonap {
  honap: string;
  nyitott_osszeg: string;
  sulyozott_osszeg: string;
  nyert_osszeg: string;
  cel?: string | null;
}

export interface TeljesitmenyItem {
  felelos?: string | null;
  nyert_db: number;
  nyert_osszeg: string;
  nyitott_sulyozott: string;
}

export interface Elorejelzes {
  honapok: ElorejelzesHonap[];
  datum_nelkul_sulyozott: string;
  sulyozott_osszesen: string;
  teljesitmeny: TeljesitmenyItem[];
  valoszinusegek: Record<string, number>;
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

export interface BankkivonatJavaslat {
  forras_tipus: string; // "ugyfel_szamla" | "alvallalkozoi_szamla"
  forras_id: number;
  projekt_id: number;
  projekt_nev: string;
  partner_nev: string;
  szamlaszam: string;
  hatralek: string;
  biztos: boolean;
}

export interface BankkivonatSor {
  sor: number;
  datum: string;
  osszeg: string;
  irany: string; // "bevetel" | "kiadas"
  kozlemeny: string;
  javaslat?: BankkivonatJavaslat | null;
  alternativak: BankkivonatJavaslat[];
}

export interface BankkivonatElemzesValasz {
  sorok: BankkivonatSor[];
  sorok_szama: number;
  egyeztetett_szama: number;
}

export interface BankkivonatJovahagyasValasz {
  feldolgozott_szama: number;
  erintett_projektek: number[];
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


export interface Atvetel {
  id: number;
  projekt_id: number;
  datum: string;
  atado_nev: string;
  atvevo_nev: string;
  hibak?: string | null;
  megjegyzes?: string | null;
  garancia_honap: number;
  allapot: "tervezet" | "alairt";
  alairva_at?: string | null;
  garancia_lejar?: string | null;
  garancia_aktiv: boolean;
  created_at: string;
}
export type AtvetelInput = {
  datum: string;
  atado_nev: string;
  atvevo_nev: string;
  hibak?: string | null;
  megjegyzes?: string | null;
  garancia_honap: number;
};

export interface NaploFoto {
  id: number;
  eredeti_nev?: string | null;
  meret?: number | null;
}
export interface NaploBejegyzes {
  id: number;
  projekt_id: number;
  datum: string;
  idojaras?: string | null;
  letszam?: number | null;
  munka: string;
  megjegyzes?: string | null;
  szerzo?: UserBrief | null;
  fotok: NaploFoto[];
  created_at: string;
}
export type NaploInput = { datum: string; idojaras?: string | null; letszam?: number | null; munka: string; megjegyzes?: string | null };

export type AjanlatAllapot = "tervezet" | "elkuldve" | "elfogadva" | "elutasitva";
export interface AjanlatSor {
  id?: number;
  megnevezes: string;
  mennyiseg: string | number;
  egyseg?: string | null;
  egysegar: string | number;
}
export interface AjanlatVerzio {
  id: number;
  verzio: number;
  allapot: AjanlatAllapot;
  ervenyes_ig?: string | null;
  megjegyzes?: string | null;
  netto_osszeg: string;
  created_at: string;
  sorok: AjanlatSor[];
}
export interface VevoiAjanlat {
  id: number;
  projekt_id: number;
  cim: string;
  created_at: string;
  verziok: AjanlatVerzio[];
}
export type AjanlatVerzioInput = { sorok: AjanlatSor[]; megjegyzes?: string | null; ervenyes_ig?: string | null };

async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error(`Hiba (${res.status})`);
  return res.blob();
}

/** Védett erőforrás blob URL-ként (pl. <img src>), mert a Bearer fejléc nem küldhető linkből. */
export async function blobUrl(path: string): Promise<string> {
  return URL.createObjectURL(await fetchBlob(path));
}

/** Védett HTML (pl. nyomtatható jegyzőkönyv) megnyitása új lapon. */
export async function openHtml(path: string): Promise<void> {
  const url = await blobUrl(path);
  window.open(url, "_blank", "noopener");
}

export interface NaptarEsemeny {
  kulcs: string;
  tipus: "feladat" | "atadas" | "tetel" | "garancia";
  cim: string;
  kezdes: string;
  vege: string;
  projekt_id?: number | null;
  kesz: boolean;
}


export interface SablonInfo {
  tipus: string;
  feltoltve: boolean;
  eredeti_nev?: string | null;
  meret?: number | null;
  feltoltve_at?: string | null;
}
export interface SablonLista {
  sablonok: SablonInfo[];
  valtozok: { nev: string; leiras: string }[];
}

/** POST-tal kért fájl letöltése (pl. generált dokumentum). */
export async function downloadPost(path: string, body: unknown, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "Letöltés sikertelen";
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  const m = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get("Content-Disposition") || "");
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  async login(username: string, password: string, otp?: string): Promise<TokenResponse> {
    return request("/auth/login/json", {
      method: "POST",
      body: JSON.stringify({ username, password, otp: otp || undefined }),
    });
  },
  elfelejtettJelszo: (azonosito: string) =>
    request<{ uzenet: string }>("/auth/elfelejtett-jelszo", { method: "POST", body: JSON.stringify({ azonosito }) }),
  ujJelszo: (token: string, password: string) =>
    request<{ uzenet: string }>("/auth/uj-jelszo", { method: "POST", body: JSON.stringify({ token, password }) }),
  tfaBeallitas: () => request<{ secret: string; otpauth_uri: string }>("/auth/2fa/beallitas", { method: "POST" }),
  tfaBekapcsolas: (code: string) =>
    request<{ totp_enabled: boolean }>("/auth/2fa/bekapcsolas", { method: "POST", body: JSON.stringify({ code }) }),
  tfaKikapcsolas: (password: string, code: string) =>
    request<{ totp_enabled: boolean }>("/auth/2fa/kikapcsolas", { method: "POST", body: JSON.stringify({ password, code }) }),
  tfaAdminVisszaallitas: (userId: number) =>
    request<{ totp_enabled: boolean }>(`/auth/users/${userId}/2fa-visszaallitas`, { method: "POST" }),
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

  kereses: (q: string) => request<KeresesResult[]>(`/kereses?q=${encodeURIComponent(q)}`),

  listErdeklodok: () => request<Erdeklodes[]>("/erdeklodok"),
  getPipeline: () => request<PipelineSzakasz[]>("/erdeklodok/pipeline"),
  createErdeklodes: (body: Partial<Erdeklodes>) =>
    request<Erdeklodes>("/erdeklodok", { method: "POST", body: JSON.stringify(body) }),
  updateErdeklodes: (id: number, body: Partial<Erdeklodes>) =>
    request<Erdeklodes>(`/erdeklodok/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteErdeklodes: (id: number) => request<void>(`/erdeklodok/${id}`, { method: "DELETE" }),
  konvertalErdeklodes: (id: number) => request<Ugyfel>(`/erdeklodok/${id}/konverzio`, { method: "POST" }),

  listKommunikacio: (params: { ugyfel_id?: number; erdeklodes_id?: number }) => {
    const qs = new URLSearchParams();
    if (params.ugyfel_id != null) qs.set("ugyfel_id", String(params.ugyfel_id));
    if (params.erdeklodes_id != null) qs.set("erdeklodes_id", String(params.erdeklodes_id));
    return request<Kommunikacio[]>(`/kommunikacio?${qs}`);
  },
  createKommunikacio: (body: { ugyfel_id?: number; erdeklodes_id?: number; tipus: KommunikacioTipus; tartalom: string }) =>
    request<Kommunikacio>("/kommunikacio", { method: "POST", body: JSON.stringify(body) }),
  deleteKommunikacio: (id: number) => request<void>(`/kommunikacio/${id}`, { method: "DELETE" }),

  listAudit: (entitas?: string) => request<AuditNaploItem[]>(`/audit${entitas ? `?entitas=${encodeURIComponent(entitas)}` : ""}`),

  listEgyediMezok: (entitas?: string) =>
    request<EgyediMezo[]>(`/egyedi-mezok${entitas ? `?entitas=${entitas}` : ""}`),
  createEgyediMezo: (body: { entitas: string; nev: string; tipus: string }) =>
    request<EgyediMezo>("/egyedi-mezok", { method: "POST", body: JSON.stringify(body) }),
  deleteEgyediMezo: (id: number) => request<void>(`/egyedi-mezok/${id}`, { method: "DELETE" }),
  getEgyediMezoErtekek: (entitas: string, entitasId: number) =>
    request<EgyediMezoErtek[]>(`/egyedi-mezok/ertekek?entitas=${entitas}&entitas_id=${entitasId}`),
  putEgyediMezoErtekek: (entitas: string, entitasId: number, ertekek: Record<number, string>) =>
    request<EgyediMezoErtek[]>("/egyedi-mezok/ertekek", {
      method: "PUT",
      body: JSON.stringify({ entitas, entitas_id: entitasId, ertekek }),
    }),

  listCimkek: () => request<Cimke[]>("/cimkek"),
  createCimke: (nev: string) => request<Cimke>("/cimkek", { method: "POST", body: JSON.stringify({ nev }) }),
  deleteCimke: (id: number) => request<void>(`/cimkek/${id}`, { method: "DELETE" }),
  listSzegmensUgyfelek: (cimkeId: number) => request<Ugyfel[]>(`/cimkek/${cimkeId}/ugyfelek`),
  getUgyfelCimkek: (ugyfelId: number) => request<Cimke[]>(`/ugyfelek/${ugyfelId}/cimkek`),
  setUgyfelCimkek: (ugyfelId: number, cimkeIds: number[]) =>
    request<Cimke[]>(`/ugyfelek/${ugyfelId}/cimkek`, { method: "PUT", body: JSON.stringify({ cimke_ids: cimkeIds }) }),

  listKampanyok: () => request<Kampany[]>("/kampanyok"),
  getKampanyCimzettek: (cimkeId?: number | null) =>
    request<{ darab: number; leiratkozott: number }>(`/kampanyok/cimzettek-szama${cimkeId != null ? `?cimke_id=${cimkeId}` : ""}`),
  sendKampany: (body: { nev: string; targy: string; uzenet: string; cimke_id?: number | null }) =>
    request<Kampany>("/kampanyok", { method: "POST", body: JSON.stringify(body) }),

  listJegyek: (params: { nyitott?: boolean; ugyfel_id?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.nyitott) qs.set("nyitott", "true");
    if (params.ugyfel_id != null) qs.set("ugyfel_id", String(params.ugyfel_id));
    return request<Jegy[]>(`/jegyek?${qs}`);
  },
  createJegy: (body: { ugyfel_id: number; targy: string; leiras?: string | null; prioritas: JegyPrioritas; felelos_id?: number | null }) =>
    request<Jegy>("/jegyek", { method: "POST", body: JSON.stringify(body) }),
  updateJegy: (id: number, body: Partial<Pick<Jegy, "allapot" | "prioritas" | "felelos_id" | "targy" | "leiras">>) =>
    request<Jegy>(`/jegyek/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteJegy: (id: number) => request<void>(`/jegyek/${id}`, { method: "DELETE" }),

  getElorejelzes: (honapok = 6) => request<Elorejelzes>(`/elorejelzes?honapok=${honapok}`),
  setErtekesitesiCel: (honap: string, osszeg: string) =>
    request<{ honap: string; osszeg: string }>("/elorejelzes/cel", { method: "PUT", body: JSON.stringify({ honap, osszeg }) }),

  getEmailBeallitas: () => request<{ email_ertesites: boolean; email: string }>("/ertesitesek/beallitas"),
  putEmailBeallitas: (email_ertesites: boolean) =>
    request<{ email_ertesites: boolean; email: string }>("/ertesitesek/beallitas", {
      method: "PUT",
      body: JSON.stringify({ email_ertesites }),
    }),
  kuldesMostErtesites: () => request<{ allapot: string }>("/ertesitesek/kuldes-most", { method: "POST" }),

  listErtesitesek: () => request<ErtesitesItem[]>("/ertesitesek"),

  importUgyfelek: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request<UgyfelImportValasz>("/ugyfelek/import", { method: "POST", body: form });
  },
  listUgyfelDuplikatumok: () => request<UgyfelDuplikatumCsoport[]>("/ugyfelek/duplikatumok"),
  egyesitUgyfelek: (celId: number, forrasId: number) =>
    request<Ugyfel>(`/ugyfelek/${celId}/egyesites`, { method: "POST", body: JSON.stringify({ forras_id: forrasId }) }),

  elemezBankkivonat: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request<BankkivonatElemzesValasz>("/bankkivonat/elemzes", { method: "POST", body: form });
  },
  jovahagyBankkivonat: (file: File, tetelek: { forras_tipus: string; forras_id: number; datum: string; osszeg: string }[]) => {
    const form = new FormData();
    form.set("file", file);
    form.set("jovahagyott_tetelek", JSON.stringify(tetelek));
    return request<BankkivonatJovahagyasValasz>("/bankkivonat/jovahagyas", { method: "POST", body: form });
  },

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

  getRollingCashflow: (params: { bucket?: string; horizon?: number; projekt_id?: number; tol?: string; ig?: string }) => {
    const q = new URLSearchParams();
    if (params.bucket) q.set("bucket", params.bucket);
    if (params.horizon) q.set("horizon", String(params.horizon));
    if (params.projekt_id) q.set("projekt_id", String(params.projekt_id));
    if (params.tol) q.set("tol", params.tol);
    if (params.ig) q.set("ig", params.ig);
    return request<CashflowRolling>(`/cashflow/rolling?${q.toString()}`);
  },
  getRollingCashflowItems: (params: {
    bucket?: string;
    horizon?: number;
    projekt_id?: number;
    tol?: string;
    ig?: string;
    kezdo_datum: string;
  }) => {
    const q = new URLSearchParams();
    if (params.bucket) q.set("bucket", params.bucket);
    if (params.horizon) q.set("horizon", String(params.horizon));
    if (params.projekt_id) q.set("projekt_id", String(params.projekt_id));
    if (params.tol) q.set("tol", params.tol);
    if (params.ig) q.set("ig", params.ig);
    q.set("kezdo_datum", params.kezdo_datum);
    return request<CashflowItem[]>(`/cashflow/rolling/items?${q.toString()}`);
  },

  listAtvetelek: (projektId: number) => request<Atvetel[]>(`/projektek/${projektId}/atvetelek`),
  createAtvetel: (projektId: number, body: AtvetelInput) =>
    request<Atvetel>(`/projektek/${projektId}/atvetelek`, { method: "POST", body: JSON.stringify(body) }),
  alairAtvetel: (id: number) => request<Atvetel>(`/atvetelek/${id}/alairas`, { method: "POST" }),
  deleteAtvetel: (id: number) => request<void>(`/atvetelek/${id}`, { method: "DELETE" }),
  openJegyzokonyv: (id: number) => openHtml(`/atvetelek/${id}/jegyzokonyv`),
  garanciaHiba: (projektId: number, body: { targy: string; leiras?: string | null }) =>
    request<Jegy>(`/projektek/${projektId}/garancia-hiba`, { method: "POST", body: JSON.stringify(body) }),
  listProjektJegyek: (projektId: number) => request<Jegy[]>(`/jegyek?projekt_id=${projektId}`),

  listNaplo: (projektId: number) => request<NaploBejegyzes[]>(`/projektek/${projektId}/naplo`),
  createNaplo: (projektId: number, body: NaploInput) =>
    request<NaploBejegyzes>(`/projektek/${projektId}/naplo`, { method: "POST", body: JSON.stringify(body) }),
  deleteNaplo: (id: number) => request<void>(`/naplo/${id}`, { method: "DELETE" }),
  uploadNaploFoto: (id: number, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request<NaploBejegyzes>(`/naplo/${id}/fotok`, { method: "POST", body: form });
  },
  deleteNaploFoto: (fotoId: number) => request<void>(`/naplo-fotok/${fotoId}`, { method: "DELETE" }),
  naploFotoUrl: (fotoId: number, thumb = false) => blobUrl(`/naplo-fotok/${fotoId}${thumb ? "?thumb=true" : ""}`),
  openNaploFoto: async (fotoId: number) => { window.open(await blobUrl(`/naplo-fotok/${fotoId}`), "_blank", "noopener"); },

  listAjanlatok: (projektId: number) => request<VevoiAjanlat[]>(`/projektek/${projektId}/ajanlatok`),
  createAjanlat: (projektId: number, body: AjanlatVerzioInput & { cim: string }) =>
    request<VevoiAjanlat>(`/projektek/${projektId}/ajanlatok`, { method: "POST", body: JSON.stringify(body) }),
  ujAjanlatVerzio: (ajanlatId: number, body: AjanlatVerzioInput) =>
    request<VevoiAjanlat>(`/ajanlatok/${ajanlatId}/verziok`, { method: "POST", body: JSON.stringify(body) }),
  setAjanlatAllapot: (verzioId: number, allapot: AjanlatAllapot) =>
    request<VevoiAjanlat>(`/ajanlat-verziok/${verzioId}/allapot`, { method: "PATCH", body: JSON.stringify({ allapot }) }),
  deleteAjanlat: (id: number) => request<void>(`/ajanlatok/${id}`, { method: "DELETE" }),

  getNaptar: (tol: string, ig: string) => request<NaptarEsemeny[]>(`/naptar?tol=${tol}&ig=${ig}`),
  downloadNaptarIcs: () => downloadFile("/naptar/export.ics", "ubrankovics-naptar.ics"),

  listSablonfajlok: () => request<SablonLista>("/sablonfajlok"),
  uploadSablonfajl: (tipus: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request<SablonInfo>(`/sablonfajlok/${tipus}`, { method: "POST", body: form });
  },
  deleteSablonfajl: (tipus: string) => request<void>(`/sablonfajlok/${tipus}`, { method: "DELETE" }),
  downloadSablonfajl: (tipus: string, nev: string) => downloadFile(`/sablonfajlok/${tipus}/letoltes`, nev),
  generalDocx: (projektId: number, body: { tipus: string; tetel_ids: number[]; uzenet?: string | null }) =>
    downloadPost(`/projektek/${projektId}/dokumentum-docx`, body, "dokumentum.docx"),
};
