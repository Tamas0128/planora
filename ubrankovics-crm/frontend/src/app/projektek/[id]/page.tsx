"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  Alvallalkozo,
  Munkanem,
  ProjektDetail,
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
  const [tab, setTab] = useState<"attekintes" | "tetelek">("attekintes");
  const [projekt, setProjekt] = useState<ProjektDetail | null>(null);
  const [tetelek, setTetelek] = useState<ProjektTetel[]>([]);
  const [munkanemek, setMunkanemek] = useState<Munkanem[]>([]);
  const [alvallalkozok, setAlvallalkozok] = useState<Alvallalkozo[]>([]);
  const [szemelyek, setSzemelyek] = useState<Szemely[]>([]);
  const [error, setError] = useState("");

  function loadProjekt() {
    api.getProjekt(projektId).then(setProjekt).catch((e) => setError(e.message));
  }
  function loadTetelek() {
    api.listTetelek(projektId).then(setTetelek).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadProjekt();
    loadTetelek();
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
        {(["attekintes", "tetelek"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t ? "border-b-2 border-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted)]"
            }`}
          >
            {t === "attekintes" ? "Áttekintés" : "Tételek"}
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

  return (
    <div className="grid gap-4 border-t border-[var(--border)] p-3 text-sm md:grid-cols-3">
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
    </div>
  );
}
