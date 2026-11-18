"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  Alvallalkozo,
  Munkanem,
  ProjektDetail,
  ProjektFazis,
  ProjektTetel,
  Szemely,
  api,
} from "@/lib/api";

const ALLAPOT_LABEL: Record<string, string> = {
  uj: "Új",
  ajanlat: "Ajánlat",
  szerzodott: "Szerződött",
  kivitelezes: "Kivitelezés",
  lezart: "Lezárt",
};

const SZAKASZ_LABEL: Record<string, string> = {
  ajanlat: "Ajánlat",
  szerzodes: "Szerződés",
  beszerzes: "Beszerzés",
  kivitelezes: "Kivitelezés",
  kesz: "Kész",
};

const VALLALAS_LABEL: Record<string, string> = {
  sajat: "Saját",
  alvallalkozo: "Alvállalkozó",
  ugyfel: "Ügyfél",
  nincs: "Nincs",
};

const ESEMENY_TIPUS_LABEL: Record<string, string> = {
  ajanlatkeres: "Ajánlatkérés",
  ajanlat_beerkezett: "Ajánlat beérkezett",
  ajanlat_ugyfelnek: "Ajánlat ügyfélnek elküldve",
  ajanlat_alairva: "Ügyfél aláírta",
  szerzodes: "Szerződés",
  anyag_megrendelve: "Anyag megrendelve",
  anyag_megerkezett: "Anyag megérkezett",
  munka_kesz: "Munka elvégezve",
};

const ESEMENY_ALLAPOT_LABEL: Record<string, string> = {
  nem_relevans: "Nem releváns",
  nyitott: "Nyitott",
  folyamatban: "Folyamatban",
  kesz: "Kész",
};

const RENDELES_ALLAPOT_LABEL: Record<string, string> = {
  tervezett: "Tervezett",
  megrendelve: "Megrendelve",
  megerkezett: "Megérkezett",
};

const SZEREP_LABEL: Record<string, string> = {
  epitesvezeto: "Építésvezető",
  projektfelelos: "Projektfelelős",
  muszaki_ellenor: "Műszaki ellenőr",
  epitesz_tervezo: "Építész tervező",
  gyartastervezo: "Gyártástervező",
};

export default function ProjektDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projektId = Number(id);
  const [tab, setTab] = useState<"attekintes" | "tetelek" | "utemezes" | "fazisok">("attekintes");
  const [projekt, setProjekt] = useState<ProjektDetail | null>(null);
  const [tetelek, setTetelek] = useState<ProjektTetel[]>([]);
  const [munkanemek, setMunkanemek] = useState<Munkanem[]>([]);
  const [alvallalkozok, setAlvallalkozok] = useState<Alvallalkozo[]>([]);
  const [szemelyek, setSzemelyek] = useState<Szemely[]>([]);
  const [fazisok, setFazisok] = useState<ProjektFazis[]>([]);
  const [error, setError] = useState("");

  function loadProjekt() {
    api.getProjekt(projektId).then(setProjekt).catch((e) => setError(e.message));
  }
  function loadTetelek() {
    api.listTetelek(projektId).then(setTetelek).catch((e) => setError(e.message));
  }
  function loadFazisok() {
    api.listFazisok(projektId).then(setFazisok).catch((e) => setError(e.message));
  }
  function loadAll() {
    loadProjekt();
    loadTetelek();
  }

  useEffect(() => {
    loadProjekt();
    loadTetelek();
    loadFazisok();
    api.listMunkanemek().then(setMunkanemek).catch(() => {});
    api.listAlvallalkozok().then(setAlvallalkozok).catch(() => {});
    api.listSzemelyek().then(setSzemelyek).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projektId]);

  if (!projekt) {
    return (
      <AppLayout>
        <p className="text-[var(--muted)]">{error || "Betöltés..."}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-1 text-xl font-semibold">{projekt.projekt_nev}</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {ALLAPOT_LABEL[projekt.allapot]} · {projekt.utemezes_aktiv ? "Ütemező aktív" : "Ütemező kikapcsolva"}
      </p>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
        {(
          projekt.utemezes_aktiv
            ? (["attekintes", "tetelek", "utemezes", "fazisok"] as const)
            : (["attekintes", "tetelek", "fazisok"] as const)
        ).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t ? "border-b-2 border-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted)]"
            }`}
          >
            {t === "attekintes" ? "Áttekintés" : t === "tetelek" ? "Tételek" : t === "utemezes" ? "Ütemezés" : "Fázisok"}
          </button>
        ))}
      </div>

      {tab === "attekintes" && (
        <AttekintesTab projekt={projekt} szemelyek={szemelyek} onChange={loadProjekt} />
      )}
      {tab === "tetelek" && (
        <TetelekTab
          projektId={projektId}
          tetelek={tetelek}
          munkanemek={munkanemek}
          alvallalkozok={alvallalkozok}
          onChange={loadTetelek}
        />
      )}
      {tab === "utemezes" && projekt.utemezes_aktiv && (
        <UtemezesTab projekt={projekt} projektId={projektId} tetelek={tetelek} onChange={loadAll} />
      )}
      {tab === "fazisok" && (
        <FazisokTab projektId={projektId} fazisok={fazisok} onChange={loadFazisok} />
      )}
    </AppLayout>
  );
}

function AttekintesTab({
  projekt,
  szemelyek,
  onChange,
}: {
  projekt: ProjektDetail;
  szemelyek: Szemely[];
  onChange: () => void;
}) {
  const [szerep, setSzerep] = useState<string>("epitesvezeto");
  const [szemelyId, setSzemelyId] = useState<string>("");

  async function addSzerep(e: FormEvent) {
    e.preventDefault();
    if (!szemelyId) return;
    await api.addProjektSzerep(projekt.id, { szemely_id: Number(szemelyId), szerep });
    setSzemelyId("");
    onChange();
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-2 text-sm font-semibold">Ügyfelek / építési címek</h2>
        <ul className="space-y-1 text-sm">
          {projekt.ugyfel_linkek.map((link) => (
            <li key={link.id} className="flex items-center justify-between">
              <span>
                {link.ugyfel.nev}
                {link.epitesi_cim ? ` — ${link.epitesi_cim}` : ""}
                {link.szerep ? ` (${link.szerep})` : ""}
              </span>
              <button
                onClick={async () => {
                  await api.removeProjektUgyfel(projekt.id, link.id);
                  onChange();
                }}
              >
                <X size={14} className="text-[var(--muted)]" />
              </button>
            </li>
          ))}
          {projekt.ugyfel_linkek.length === 0 && <li className="text-[var(--muted)]">Nincs hozzárendelt ügyfél.</li>}
        </ul>
      </section>

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-2 text-sm font-semibold">Szerepek (építésvezető, projektfelelős, stb.)</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {projekt.szerepek.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>
                {SZEREP_LABEL[s.szerep] || s.szerep}: {s.szemely.nev}
              </span>
              <button
                onClick={async () => {
                  await api.removeProjektSzerep(projekt.id, s.id);
                  onChange();
                }}
              >
                <X size={14} className="text-[var(--muted)]" />
              </button>
            </li>
          ))}
          {projekt.szerepek.length === 0 && <li className="text-[var(--muted)]">Nincs még megadva.</li>}
        </ul>
        <form onSubmit={addSzerep} className="flex gap-2">
          <select
            value={szerep}
            onChange={(e) => setSzerep(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-sm"
          >
            {Object.entries(SZEREP_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={szemelyId}
            onChange={(e) => setSzemelyId(e.target.value)}
            className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-sm"
          >
            <option value="">Személy...</option>
            {szemelyek.map((sz) => (
              <option key={sz.id} value={sz.id}>
                {sz.nev}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1 text-sm text-[var(--primary-foreground)]">
            Hozzáad
          </button>
        </form>
      </section>
    </div>
  );
}

function TetelekTab({
  projektId,
  tetelek,
  munkanemek,
  alvallalkozok,
  onChange,
}: {
  projektId: number;
  tetelek: ProjektTetel[];
  munkanemek: Munkanem[];
  alvallalkozok: Alvallalkozo[];
  onChange: () => void;
}) {
  const [munkanemId, setMunkanemId] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  async function addTetel(e: FormEvent) {
    e.preventDefault();
    if (!munkanemId) return;
    await api.createTetel(projektId, { munkanem_id: Number(munkanemId) });
    setMunkanemId("");
    onChange();
  }

  return (
    <div>
      <form onSubmit={addTetel} className="mb-4 flex max-w-md gap-2">
        <select
          value={munkanemId}
          onChange={(e) => setMunkanemId(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        >
          <option value="">Munkanem kiválasztása...</option>
          {munkanemek.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nev}
            </option>
          ))}
        </select>
        <button type="submit" className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]">
          <Plus size={14} /> Tétel
        </button>
      </form>

      <div className="space-y-2">
        {tetelek.map((t) => (
          <div key={t.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
            <button
              onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                {expanded === t.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {t.munkanem.nev}
              </span>
              <span className="text-xs text-[var(--muted)]">{SZAKASZ_LABEL[t.szakasz] || t.szakasz}</span>
            </button>
            {expanded === t.id && (
              <TetelDetail
                projektId={projektId}
                tetel={t}
                alvallalkozok={alvallalkozok}
                onChange={onChange}
              />
            )}
          </div>
        ))}
        {tetelek.length === 0 && <p className="text-sm text-[var(--muted)]">Nincs még tétel ezen a projekten.</p>}
      </div>
    </div>
  );
}

function TetelDetail({
  projektId,
  tetel,
  alvallalkozok,
  onChange,
}: {
  projektId: number;
  tetel: ProjektTetel;
  alvallalkozok: Alvallalkozo[];
  onChange: () => void;
}) {
  const [szakasz, setSzakasz] = useState(tetel.szakasz);
  const [vallalasTipus, setVallalasTipus] = useState("sajat");
  const [vallalasAlvId, setVallalasAlvId] = useState("");
  const [esemenyTipus, setEsemenyTipus] = useState("ajanlatkeres");
  const [esemenyDatum, setEsemenyDatum] = useState("");
  const [specKulcs, setSpecKulcs] = useState("");
  const [specErtek, setSpecErtek] = useState("");
  const [rendMegnevezes, setRendMegnevezes] = useState("");
  const [rendBeszallito, setRendBeszallito] = useState("");
  const [rendOsszeg, setRendOsszeg] = useState("");

  async function saveSzakasz() {
    await api.updateTetel(projektId, tetel.id, { szakasz });
    onChange();
  }

  async function addVallalas(e: FormEvent) {
    e.preventDefault();
    await api.addVallalas(projektId, tetel.id, {
      tipus: vallalasTipus,
      alvallalkozo_id: vallalasTipus === "alvallalkozo" && vallalasAlvId ? Number(vallalasAlvId) : null,
    });
    setVallalasAlvId("");
    onChange();
  }

  async function addEsemeny(e: FormEvent) {
    e.preventDefault();
    await api.addEsemeny(projektId, tetel.id, {
      tipus: esemenyTipus,
      datum: esemenyDatum || null,
      allapot: "kesz",
    });
    setEsemenyDatum("");
    onChange();
  }

  async function addSpec(e: FormEvent) {
    e.preventDefault();
    if (!specKulcs || !specErtek) return;
    await api.addSpecifikacio(projektId, tetel.id, { kulcs: specKulcs, ertek: specErtek });
    setSpecKulcs("");
    setSpecErtek("");
    onChange();
  }

  async function addRendeles(e: FormEvent) {
    e.preventDefault();
    if (!rendMegnevezes) return;
    await api.addRendeles(projektId, tetel.id, {
      megnevezes: rendMegnevezes,
      beszallito: rendBeszallito || null,
      osszeg: rendOsszeg || null,
    });
    setRendMegnevezes("");
    setRendBeszallito("");
    setRendOsszeg("");
    onChange();
  }

  return (
    <div className="grid gap-4 border-t border-[var(--border)] p-3 text-sm md:grid-cols-4">
      <div>
        <h3 className="mb-1 font-semibold">Szakasz</h3>
        <div className="flex gap-2">
          <select
            value={szakasz}
            onChange={(e) => setSzakasz(e.target.value as typeof szakasz)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          >
            {Object.entries(SZAKASZ_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button onClick={saveSzakasz} className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
            Mentés
          </button>
        </div>

        <h3 className="mb-1 mt-4 font-semibold">Vállalások</h3>
        <ul className="mb-2 space-y-1">
          {tetel.vallalasok.map((v) => (
            <li key={v.id} className="flex items-center justify-between">
              <span>
                {VALLALAS_LABEL[v.tipus] || v.tipus}
                {v.alvallalkozo ? ` — ${v.alvallalkozo.nev}` : ""}
              </span>
              <button
                onClick={async () => {
                  await api.removeVallalas(projektId, tetel.id, v.id);
                  onChange();
                }}
              >
                <X size={12} className="text-[var(--muted)]" />
              </button>
            </li>
          ))}
          {tetel.vallalasok.length === 0 && <li className="text-[var(--muted)]">Nincs még vállaló.</li>}
        </ul>
        <form onSubmit={addVallalas} className="flex flex-col gap-1">
          <select
            value={vallalasTipus}
            onChange={(e) => setVallalasTipus(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          >
            {Object.entries(VALLALAS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {vallalasTipus === "alvallalkozo" && (
            <select
              value={vallalasAlvId}
              onChange={(e) => setVallalasAlvId(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
            >
              <option value="">Alvállalkozó...</option>
              {alvallalkozok.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nev}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
            Vállaló hozzáadása
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-1 font-semibold">Események</h3>
        <ul className="mb-2 space-y-1">
          {tetel.esemenyek.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between">
              <span>
                {ESEMENY_TIPUS_LABEL[ev.tipus] || ev.tipus}
                {ev.datum ? ` — ${ev.datum}` : ""} ({ESEMENY_ALLAPOT_LABEL[ev.allapot] || ev.allapot})
              </span>
              <button
                onClick={async () => {
                  await api.removeEsemeny(projektId, tetel.id, ev.id);
                  onChange();
                }}
              >
                <X size={12} className="text-[var(--muted)]" />
              </button>
            </li>
          ))}
          {tetel.esemenyek.length === 0 && <li className="text-[var(--muted)]">Nincs még esemény.</li>}
        </ul>
        <form onSubmit={addEsemeny} className="flex flex-col gap-1">
          <select
            value={esemenyTipus}
            onChange={(e) => setEsemenyTipus(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          >
            {Object.entries(ESEMENY_TIPUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={esemenyDatum}
            onChange={(e) => setEsemenyDatum(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          />
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
            Esemény rögzítése
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-1 font-semibold">Specifikáció</h3>
        <ul className="mb-2 space-y-1">
          {tetel.specifikaciok.map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <span>
                {s.kulcs}: {s.ertek}
              </span>
              <button
                onClick={async () => {
                  await api.removeSpecifikacio(projektId, tetel.id, s.id);
                  onChange();
                }}
              >
                <X size={12} className="text-[var(--muted)]" />
              </button>
            </li>
          ))}
          {tetel.specifikaciok.length === 0 && <li className="text-[var(--muted)]">Nincs még specifikáció.</li>}
        </ul>
        <form onSubmit={addSpec} className="flex flex-col gap-1">
          <input
            placeholder="Kulcs (pl. Gyártó)"
            value={specKulcs}
            onChange={(e) => setSpecKulcs(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          />
          <input
            placeholder="Érték"
            value={specErtek}
            onChange={(e) => setSpecErtek(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          />
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
            Hozzáadás
          </button>
        </form>
      </div>

      <div>
        <h3 className="mb-1 font-semibold">Beszerzés (anyagrendelés)</h3>
        <ul className="mb-2 space-y-1">
          {tetel.rendelesek.map((r) => (
            <li key={r.id} className="space-y-0.5 border-b border-[var(--border)] pb-1 last:border-b-0">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.megnevezes}</span>
                <button
                  onClick={async () => {
                    await api.removeRendeles(projektId, tetel.id, r.id);
                    onChange();
                  }}
                >
                  <X size={12} className="text-[var(--muted)]" />
                </button>
              </div>
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span>
                  {r.beszallito || "—"}
                  {r.osszeg ? ` · ${Number(r.osszeg).toLocaleString("hu-HU")} Ft` : ""}
                </span>
                <select
                  value={r.allapot}
                  onChange={async (e) => {
                    await api.updateRendeles(projektId, tetel.id, r.id, { allapot: e.target.value });
                    onChange();
                  }}
                  className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
                >
                  {Object.entries(RENDELES_ALLAPOT_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
          {tetel.rendelesek.length === 0 && <li className="text-[var(--muted)]">Nincs még rendelés.</li>}
        </ul>
        <form onSubmit={addRendeles} className="flex flex-col gap-1">
          <input
            placeholder="Megnevezés (pl. Ablak - nappali)"
            value={rendMegnevezes}
            onChange={(e) => setRendMegnevezes(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          />
          <input
            placeholder="Beszállító"
            value={rendBeszallito}
            onChange={(e) => setRendBeszallito(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          />
          <input
            type="number"
            min={0}
            placeholder="Összeg (Ft)"
            value={rendOsszeg}
            onChange={(e) => setRendOsszeg(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
          />
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
            Hozzáadás
          </button>
        </form>
      </div>
    </div>
  );
}

function dayDiff(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function UtemezesTab({
  projekt,
  projektId,
  tetelek,
  onChange,
}: {
  projekt: ProjektDetail;
  projektId: number;
  tetelek: ProjektTetel[];
  onChange: () => void;
}) {
  const [deliveryDate, setDeliveryDate] = useState(projekt.delivery_date || "");
  const [error, setError] = useState("");

  async function saveDeliveryDate() {
    setError("");
    try {
      await api.updateProjekt(projektId, { delivery_date: deliveryDate || null });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function recalc() {
    setError("");
    try {
      await api.recalculateUtemezes(projektId);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  const scheduled = tetelek.filter((t) => t.start_date && t.end_date);
  const allDates = scheduled.flatMap((t) => [t.start_date as string, t.end_date as string]);
  const minDate = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = projekt.delivery_date || (allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : null);
  const totalDays = minDate && maxDate ? dayDiff(minDate, maxDate) + 1 : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
        <div>
          <label className="block text-xs text-[var(--muted)]">Átadási határidő</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-sm"
          />
        </div>
        <button onClick={saveDeliveryDate} className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]">
          Mentés
        </button>
        <button onClick={recalc} className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
          Újraütemezés
        </button>
        <div className="ml-auto text-sm text-[var(--muted)]">Készültség: {projekt.completion_percent}%</div>
      </div>
      {error && <div className="mb-3 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {minDate && maxDate && totalDays > 0 && (
        <div className="mb-4 space-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          {scheduled.map((t) => {
            const offset = dayDiff(minDate, t.start_date as string);
            const span = dayDiff(t.start_date as string, t.end_date as string) + 1;
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <div className="w-40 shrink-0 truncate">{t.munkanem.nev}</div>
                <div className="relative h-5 flex-1 rounded bg-black/5">
                  <div
                    className="absolute top-0 h-5 rounded bg-[var(--primary)]"
                    style={{
                      left: `${(offset / totalDays) * 100}%`,
                      width: `${Math.max((span / totalDays) * 100, 1.5)}%`,
                    }}
                    title={`${t.start_date} – ${t.end_date}`}
                  />
                </div>
                <div className="w-32 shrink-0 text-right text-[var(--muted)]">
                  {t.start_date} – {t.end_date}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Tétel</th>
              <th className="px-3 py-2">Időtartam (nap)</th>
              <th className="px-3 py-2">Előkészítés (nap)</th>
              <th className="px-3 py-2">Terv</th>
              <th className="px-3 py-2">Várható</th>
              <th className="px-3 py-2">Tényleges</th>
              <th className="px-3 py-2">Függőségek</th>
            </tr>
          </thead>
          <tbody>
            {tetelek.map((t) => (
              <TetelUtemezesRow key={t.id} projektId={projektId} tetel={t} osszes={tetelek} onChange={onChange} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TetelUtemezesRow({
  projektId,
  tetel,
  osszes,
  onChange,
}: {
  projektId: number;
  tetel: ProjektTetel;
  osszes: ProjektTetel[];
  onChange: () => void;
}) {
  const [duration, setDuration] = useState(tetel.duration_days != null ? String(tetel.duration_days) : "");
  const [prep, setPrep] = useState(String(tetel.prep_days));
  const [tenylegesKezdes, setTenylegesKezdes] = useState(tetel.tenyleges_kezdes || "");
  const [tenylegesBefejezes, setTenylegesBefejezes] = useState(tetel.tenyleges_befejezes || "");
  const [addPrereq, setAddPrereq] = useState("");

  async function save() {
    await api.updateTetel(projektId, tetel.id, {
      duration_days: duration ? Number(duration) : null,
      prep_days: prep ? Number(prep) : 0,
    });
    onChange();
  }

  async function saveTenyleges() {
    await api.updateTetel(projektId, tetel.id, {
      tenyleges_kezdes: tenylegesKezdes || null,
      tenyleges_befejezes: tenylegesBefejezes || null,
    });
    onChange();
  }

  async function addDep() {
    if (!addPrereq) return;
    await api.addFuggoseg(projektId, tetel.id, Number(addPrereq));
    setAddPrereq("");
    onChange();
  }

  return (
    <tr className="border-t border-[var(--border)] align-top">
      <td className="px-3 py-2 whitespace-nowrap">{tetel.munkanem.nev}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={save}
          className="w-16 rounded border border-[var(--border)] px-1 py-0.5"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={prep}
          onChange={(e) => setPrep(e.target.value)}
          onBlur={save}
          className="w-16 rounded border border-[var(--border)] px-1 py-0.5"
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
        {tetel.terv_kezdes && tetel.terv_befejezes ? `${tetel.terv_kezdes} – ${tetel.terv_befejezes}` : "—"}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
        {tetel.start_date && tetel.end_date ? `${tetel.start_date} – ${tetel.end_date}` : "—"}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <input
            type="date"
            value={tenylegesKezdes}
            onChange={(e) => setTenylegesKezdes(e.target.value)}
            onBlur={saveTenyleges}
            className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
          />
          <input
            type="date"
            value={tenylegesBefejezes}
            onChange={(e) => setTenylegesBefejezes(e.target.value)}
            onBlur={saveTenyleges}
            className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <ul className="mb-1 space-y-0.5">
          {tetel.fuggosegek.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
              <span>{f.prerequisite_nev}</span>
              <button
                onClick={async () => {
                  await api.removeFuggoseg(projektId, tetel.id, f.id);
                  onChange();
                }}
              >
                <X size={10} className="text-[var(--muted)]" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <select
            value={addPrereq}
            onChange={(e) => setAddPrereq(e.target.value)}
            className="flex-1 rounded border border-[var(--border)] px-1 py-0.5 text-xs"
          >
            <option value="">+ függőség</option>
            {osszes
              .filter((o) => o.id !== tetel.id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.munkanem.nev}
                </option>
              ))}
          </select>
          <button onClick={addDep} className="text-[var(--primary)]">
            <Plus size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function FazisokTab({
  projektId,
  fazisok,
  onChange,
}: {
  projektId: number;
  fazisok: ProjektFazis[];
  onChange: () => void;
}) {
  const [ujFazisNev, setUjFazisNev] = useState("");

  async function addFazis(e: FormEvent) {
    e.preventDefault();
    if (!ujFazisNev) return;
    await api.addFazis(projektId, ujFazisNev);
    setUjFazisNev("");
    onChange();
  }

  const osszesLepes = fazisok.reduce((a, f) => a + f.lepesek.length, 0);
  const keszLepes = fazisok.reduce((a, f) => a + f.lepesek.filter((l) => l.kesz).length, 0);

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
        <span>
          Kész lépések: {keszLepes} / {osszesLepes}
        </span>
        <form onSubmit={addFazis} className="flex gap-2">
          <input
            placeholder="Új fázis neve"
            value={ujFazisNev}
            onChange={(e) => setUjFazisNev(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-sm"
          />
          <button type="submit" className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1 text-sm text-[var(--primary-foreground)]">
            <Plus size={14} /> Fázis
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {fazisok.map((f) => (
          <FazisCard key={f.id} projektId={projektId} fazis={f} onChange={onChange} />
        ))}
        {fazisok.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Nincs még fázis — válassz épülettípust a projekt létrehozásakor, vagy adj hozzá sajátot.
          </p>
        )}
      </div>
    </div>
  );
}

function FazisCard({
  projektId,
  fazis,
  onChange,
}: {
  projektId: number;
  fazis: ProjektFazis;
  onChange: () => void;
}) {
  const [ujLepesNev, setUjLepesNev] = useState("");

  async function addLepes(e: FormEvent) {
    e.preventDefault();
    if (!ujLepesNev) return;
    await api.addLepes(projektId, fazis.id, { nev: ujLepesNev });
    setUjLepesNev("");
    onChange();
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <h3 className="font-heading font-semibold">{fazis.nev}</h3>
        <button
          onClick={async () => {
            await api.removeFazis(projektId, fazis.id);
            onChange();
          }}
        >
          <X size={14} className="text-[var(--muted)]" />
        </button>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {fazis.lepesek.map((l) => (
          <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={l.kesz}
              onChange={async (e) => {
                await api.updateLepes(projektId, fazis.id, l.id, { kesz: e.target.checked });
                onChange();
              }}
            />
            <span className={`flex-1 ${l.merfoldko ? "font-semibold" : ""} ${l.kesz ? "line-through text-[var(--muted)]" : ""}`}>
              {l.nev}
            </span>
            <button
              onClick={async () => {
                await api.removeLepes(projektId, fazis.id, l.id);
                onChange();
              }}
            >
              <X size={12} className="text-[var(--muted)]" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={addLepes} className="flex gap-2 p-3">
        <input
          placeholder="Új lépés"
          value={ujLepesNev}
          onChange={(e) => setUjLepesNev(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1 text-sm">
          Hozzáad
        </button>
      </form>
    </div>
  );
}
