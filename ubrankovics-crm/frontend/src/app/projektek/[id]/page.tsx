"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronRight, Download, GripVertical, Plus, Trash2, X } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AppLayout from "@/components/AppLayout";
import Modal from "@/components/Modal";
import {
  Ajanlatkeres,
  AnyagRendeles,
  Alvallalkozo,
  Dokumentum,
  KikuldottEmail,
  Munkanem,
  ProjektDetail,
  ProjektFazis,
  ProjektTetel,
  SablonElonezet,
  Szemely,
  api,
  downloadFile,
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
  igeny: "Igény",
  ajanlatkeres_alatt: "Ajánlatkérés alatt",
  megrendelve: "Megrendelve",
  visszaigazolva: "Visszaigazolva",
  szallitas_alatt: "Szállítás alatt",
  megerkezett: "Megérkezett",
  reklamacio: "Reklamáció",
};

const AJANLATKERES_ALLAPOT_LABEL: Record<string, string> = {
  kikuldve: "Kiküldve",
  valaszra_var: "Válaszra vár",
  valasz_erkezett: "Válasz érkezett",
  lejart: "Lejárt",
};

const VAT_LABEL: Record<string, string> = {
  afa_27: "27% ÁFA",
  afa_5: "5% ÁFA",
  afa_0: "0% ÁFA",
  forditott: "Fordított áfás",
};

const SZAMLA_ALLAPOT_LABEL: Record<string, string> = {
  nincs: "Nincs",
  megerkezett: "Megérkezett",
  kifizetve: "Kifizetve",
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
  const [tab, setTab] = useState<"attekintes" | "tetelek" | "utemezes" | "fazisok" | "dokumentumok">("attekintes");
  const [projekt, setProjekt] = useState<ProjektDetail | null>(null);
  const [tetelek, setTetelek] = useState<ProjektTetel[]>([]);
  const [munkanemek, setMunkanemek] = useState<Munkanem[]>([]);
  const [alvallalkozok, setAlvallalkozok] = useState<Alvallalkozo[]>([]);
  const [szemelyek, setSzemelyek] = useState<Szemely[]>([]);
  const [fazisok, setFazisok] = useState<ProjektFazis[]>([]);
  const [dokumentumok, setDokumentumok] = useState<Dokumentum[]>([]);
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
  function loadDokumentumok() {
    api.listDokumentumok(projektId).then(setDokumentumok).catch((e) => setError(e.message));
  }
  function loadAll() {
    loadProjekt();
    loadTetelek();
  }

  useEffect(() => {
    loadProjekt();
    loadTetelek();
    loadFazisok();
    loadDokumentumok();
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

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {(
          projekt.utemezes_aktiv
            ? (["attekintes", "tetelek", "utemezes", "fazisok", "dokumentumok"] as const)
            : (["attekintes", "tetelek", "fazisok", "dokumentumok"] as const)
        ).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === t ? "border-b-2 border-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted)]"
            }`}
          >
            {t === "attekintes"
              ? "Áttekintés"
              : t === "tetelek"
              ? "Tételek"
              : t === "utemezes"
              ? "Ütemezés"
              : t === "fazisok"
              ? "Fázisok"
              : "Dokumentumok"}
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
        <UtemezesTab projekt={projekt} projektId={projektId} tetelek={tetelek} szemelyek={szemelyek} onChange={loadAll} />
      )}
      {tab === "fazisok" && (
        <FazisokTab projektId={projektId} fazisok={fazisok} onChange={loadFazisok} />
      )}
      {tab === "dokumentumok" && (
        <DokumentumokTab projektId={projektId} dokumentumok={dokumentumok} onChange={loadDokumentumok} />
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
    <div className="grid max-w-3xl grid-cols-1 gap-6">
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
  const [kivalasztott, setKivalasztott] = useState<Set<number>>(new Set());

  async function addTetel(e: FormEvent) {
    e.preventDefault();
    if (!munkanemId) return;
    await api.createTetel(projektId, { munkanem_id: Number(munkanemId) });
    setMunkanemId("");
    onChange();
  }

  function toggleKivalasztott(id: number) {
    setKivalasztott((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            <div className="flex w-full items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                checked={kivalasztott.has(t.id)}
                onChange={() => toggleKivalasztott(t.id)}
                title="Kijelölés levélhez"
              />
              <button
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="flex flex-1 items-center justify-between text-left text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  {expanded === t.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {t.munkanem.nev}
                </span>
                <span className="text-xs text-[var(--muted)]">{SZAKASZ_LABEL[t.szakasz] || t.szakasz}</span>
              </button>
            </div>
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

      <EmailKuldesPanel projektId={projektId} tetelIds={[...kivalasztott]} />
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
    <div className="border-t border-[var(--border)] p-3 text-sm">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      <RendelesSection projektId={projektId} tetel={tetel} onChange={onChange} />
    </div>
  );
}

function RendelesSection({
  projektId,
  tetel,
  onChange,
}: {
  projektId: number;
  tetel: ProjektTetel;
  onChange: () => void;
}) {
  const [megnevezes, setMegnevezes] = useState("");
  const [mennyiseg, setMennyiseg] = useState("");
  const [mertekegyseg, setMertekegyseg] = useState("");
  const [szuksegesDatum, setSzuksegesDatum] = useState("");

  async function addRendeles(e: FormEvent) {
    e.preventDefault();
    if (!megnevezes) return;
    await api.addRendeles(projektId, tetel.id, {
      megnevezes,
      mennyiseg: mennyiseg || null,
      mertekegyseg: mertekegyseg || null,
      szukseges_datum: szuksegesDatum || null,
    });
    setMegnevezes("");
    setMennyiseg("");
    setMertekegyseg("");
    setSzuksegesDatum("");
    onChange();
  }

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <h3 className="mb-2 font-semibold">Beszerzés (anyagrendelés)</h3>
      <div className="space-y-2">
        {tetel.rendelesek.map((r) => (
          <RendelesCard key={r.id} projektId={projektId} tetelId={tetel.id} rendeles={r} onChange={onChange} />
        ))}
        {tetel.rendelesek.length === 0 && <p className="text-[var(--muted)]">Nincs még beszerzési igény.</p>}
      </div>
      <form onSubmit={addRendeles} className="mt-3 flex flex-wrap items-end gap-2">
        <input
          placeholder="Megnevezés (pl. Ablak - nappali)"
          value={megnevezes}
          onChange={(e) => setMegnevezes(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
        />
        <input
          type="number"
          min={0}
          placeholder="Mennyiség"
          value={mennyiseg}
          onChange={(e) => setMennyiseg(e.target.value)}
          className="w-24 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
        />
        <input
          placeholder="Me."
          value={mertekegyseg}
          onChange={(e) => setMertekegyseg(e.target.value)}
          className="w-16 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
        />
        <input
          type="date"
          value={szuksegesDatum}
          onChange={(e) => setSzuksegesDatum(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
        />
        <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
          Beszerzési igény hozzáadása
        </button>
      </form>
    </div>
  );
}

function RendelesCard({
  projektId,
  tetelId,
  rendeles,
  onChange,
}: {
  projektId: number;
  tetelId: number;
  rendeles: AnyagRendeles;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [akCimzettNev, setAkCimzettNev] = useState("");
  const [akCimzettEmail, setAkCimzettEmail] = useState("");
  const [akHatarido, setAkHatarido] = useState("");
  const [ugyfelNetto, setUgyfelNetto] = useState(rendeles.ugyfel_netto || "");
  const [ugyfelAfa, setUgyfelAfa] = useState(rendeles.ugyfel_afa_tipus || "afa_0");
  const [poSzam, setPoSzam] = useState(rendeles.po_szam || "");
  const [szamlaSzam, setSzamlaSzam] = useState(rendeles.szamla_szam || "");
  const [szamlaOsszeg, setSzamlaOsszeg] = useState(rendeles.szamla_osszeg || "");

  async function addAjanlatkeres(e: FormEvent) {
    e.preventDefault();
    if (!akCimzettNev) return;
    await api.addAjanlatkeres(projektId, tetelId, rendeles.id, {
      cimzett_nev: akCimzettNev,
      cimzett_email: akCimzettEmail || null,
      hatarido: akHatarido || null,
    });
    setAkCimzettNev("");
    setAkCimzettEmail("");
    setAkHatarido("");
    onChange();
  }

  async function saveUgyfelAr(e: FormEvent) {
    e.preventDefault();
    if (!ugyfelNetto) return;
    await api.setUgyfelAr(projektId, tetelId, rendeles.id, {
      ugyfel_netto: ugyfelNetto,
      ugyfel_afa_tipus: ugyfelAfa,
    });
    onChange();
  }

  async function updateAllapot(allapot: string) {
    await api.updateRendeles(projektId, tetelId, rendeles.id, { allapot });
    onChange();
  }

  async function savePo() {
    if (!poSzam) return;
    await api.updateRendeles(projektId, tetelId, rendeles.id, {
      po_szam: poSzam,
      jovahagyva: true,
      jovahagyas_datum: new Date().toISOString().slice(0, 10),
    });
    onChange();
  }

  async function saveSzamla(e: FormEvent) {
    e.preventDefault();
    await api.updateRendeles(projektId, tetelId, rendeles.id, {
      szamla_szam: szamlaSzam || null,
      szamla_osszeg: szamlaOsszeg || null,
    });
    onChange();
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] p-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 font-medium">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {rendeles.megnevezes}
          {rendeles.mennyiseg ? ` (${rendeles.mennyiseg} ${rendeles.mertekegyseg || ""})` : ""}
        </button>
        <div className="flex items-center gap-2">
          <select
            value={rendeles.allapot}
            onChange={(e) => updateAllapot(e.target.value)}
            className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
          >
            {Object.entries(RENDELES_ALLAPOT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              await api.removeRendeles(projektId, tetelId, rendeles.id);
              onChange();
            }}
          >
            <X size={12} className="text-[var(--muted)]" />
          </button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
        <span>Beszállító: {rendeles.beszallito || "—"}</span>
        <span>
          Beszerzési ár: {rendeles.beszerzesi_brutto ? `${Number(rendeles.beszerzesi_brutto).toLocaleString("hu-HU")} Ft` : "—"}
        </span>
        <span>Ügyfél ár: {rendeles.ugyfel_brutto ? `${Number(rendeles.ugyfel_brutto).toLocaleString("hu-HU")} Ft` : "—"}</span>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-2 md:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Ajánlatkérések</h4>
            <ul className="mb-2 space-y-2">
              {rendeles.ajanlatkeresek.map((ak) => (
                <AjanlatkeresRow
                  key={ak.id}
                  projektId={projektId}
                  tetelId={tetelId}
                  rendeles={rendeles}
                  ajanlatkeres={ak}
                  onChange={onChange}
                />
              ))}
              {rendeles.ajanlatkeresek.length === 0 && (
                <li className="text-[var(--muted)]">Nincs még ajánlatkérés.</li>
              )}
            </ul>
            <form onSubmit={addAjanlatkeres} className="flex flex-col gap-1">
              <input
                placeholder="Cimzett neve"
                value={akCimzettNev}
                onChange={(e) => setAkCimzettNev(e.target.value)}
                className="rounded border border-[var(--border)] px-2 py-1"
              />
              <input
                placeholder="Email (opcionális)"
                value={akCimzettEmail}
                onChange={(e) => setAkCimzettEmail(e.target.value)}
                className="rounded border border-[var(--border)] px-2 py-1"
              />
              <input
                type="date"
                value={akHatarido}
                onChange={(e) => setAkHatarido(e.target.value)}
                className="rounded border border-[var(--border)] px-2 py-1"
              />
              <button type="submit" className="rounded bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
                Ajánlatkérés kiküldése
              </button>
            </form>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Ügyfélnek kiajánlott ár</h4>
              <form onSubmit={saveUgyfelAr} className="flex flex-wrap items-end gap-2">
                <input
                  type="number"
                  placeholder="Nettó"
                  value={ugyfelNetto}
                  onChange={(e) => setUgyfelNetto(e.target.value)}
                  className="w-28 rounded border border-[var(--border)] px-2 py-1"
                />
                <select
                  value={ugyfelAfa}
                  onChange={(e) => setUgyfelAfa(e.target.value)}
                  className="rounded border border-[var(--border)] px-2 py-1"
                >
                  {Object.entries(VAT_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
                  Mentés
                </button>
              </form>
              {rendeles.ugyfel_brutto && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  ÁFA: {Number(rendeles.ugyfel_afa).toLocaleString("hu-HU")} Ft · Bruttó:{" "}
                  {Number(rendeles.ugyfel_brutto).toLocaleString("hu-HU")} Ft
                </p>
              )}
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Megrendelés (PO)</h4>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  placeholder="PO szám"
                  value={poSzam}
                  onChange={(e) => setPoSzam(e.target.value)}
                  className="rounded border border-[var(--border)] px-2 py-1"
                />
                <button type="button" onClick={savePo} className="rounded bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
                  Jóváhagyás
                </button>
                {rendeles.jovahagyva && (
                  <span className="text-xs text-[var(--muted)]">
                    Jóváhagyva{rendeles.jovahagyas_datum ? ` (${rendeles.jovahagyas_datum})` : ""}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Szállítás / átvétel</h4>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="date"
                  value={rendeles.tenyleges_erkezes || ""}
                  onChange={async (e) => {
                    await api.updateRendeles(projektId, tetelId, rendeles.id, {
                      tenyleges_erkezes: e.target.value || null,
                    });
                    onChange();
                  }}
                  className="rounded border border-[var(--border)] px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Átvett menny."
                  value={rendeles.atvett_mennyiseg || ""}
                  onChange={async (e) => {
                    await api.updateRendeles(projektId, tetelId, rendeles.id, {
                      atvett_mennyiseg: e.target.value || null,
                    });
                    onChange();
                  }}
                  className="w-28 rounded border border-[var(--border)] px-2 py-1"
                />
              </div>
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Számla</h4>
              <form onSubmit={saveSzamla} className="flex flex-wrap items-end gap-2">
                <input
                  placeholder="Számlaszám"
                  value={szamlaSzam}
                  onChange={(e) => setSzamlaSzam(e.target.value)}
                  className="rounded border border-[var(--border)] px-2 py-1"
                />
                <input
                  type="number"
                  placeholder="Összeg"
                  value={szamlaOsszeg}
                  onChange={(e) => setSzamlaOsszeg(e.target.value)}
                  className="w-28 rounded border border-[var(--border)] px-2 py-1"
                />
                <select
                  value={rendeles.szamla_allapot}
                  onChange={async (e) => {
                    await api.updateRendeles(projektId, tetelId, rendeles.id, { szamla_allapot: e.target.value });
                    onChange();
                  }}
                  className="rounded border border-[var(--border)] px-2 py-1"
                >
                  {Object.entries(SZAMLA_ALLAPOT_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded bg-[var(--primary)] px-2 py-1 text-[var(--primary-foreground)]">
                  Mentés
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AjanlatkeresRow({
  projektId,
  tetelId,
  rendeles,
  ajanlatkeres,
  onChange,
}: {
  projektId: number;
  tetelId: number;
  rendeles: AnyagRendeles;
  ajanlatkeres: Ajanlatkeres;
  onChange: () => void;
}) {
  const [netto, setNetto] = useState("");
  const [afaTipus, setAfaTipus] = useState("forditott");

  async function addAjanlat(e: FormEvent) {
    e.preventDefault();
    if (!netto) return;
    await api.addBeszallitoiAjanlat(projektId, tetelId, rendeles.id, ajanlatkeres.id, {
      netto,
      afa_tipus: afaTipus,
    });
    setNetto("");
    onChange();
  }

  return (
    <li className="rounded border border-[var(--border)] p-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{ajanlatkeres.cimzett_nev}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">
            {AJANLATKERES_ALLAPOT_LABEL[ajanlatkeres.allapot] || ajanlatkeres.allapot}
          </span>
          <button
            onClick={async () => {
              await api.removeAjanlatkeres(projektId, tetelId, rendeles.id, ajanlatkeres.id);
              onChange();
            }}
          >
            <X size={12} className="text-[var(--muted)]" />
          </button>
        </div>
      </div>
      <ul className="mt-1 space-y-1">
        {ajanlatkeres.ajanlatok.map((aj) => (
          <li key={aj.id} className="flex items-center justify-between text-xs">
            <span>
              {Number(aj.netto).toLocaleString("hu-HU")} + ÁFA = {Number(aj.brutto).toLocaleString("hu-HU")} Ft
              {rendeles.kivalasztott_ajanlat_id === aj.id && " ✓ kiválasztva"}
            </span>
            <div className="flex items-center gap-1">
              {rendeles.kivalasztott_ajanlat_id !== aj.id && (
                <button
                  type="button"
                  onClick={async () => {
                    await api.valasztAjanlat(projektId, tetelId, rendeles.id, aj.id);
                    onChange();
                  }}
                  className="rounded border border-[var(--border)] px-1 py-0.5"
                >
                  Kiválasztás
                </button>
              )}
              <button
                onClick={async () => {
                  await api.removeBeszallitoiAjanlat(projektId, tetelId, rendeles.id, ajanlatkeres.id, aj.id);
                  onChange();
                }}
              >
                <X size={10} className="text-[var(--muted)]" />
              </button>
            </div>
          </li>
        ))}
        {ajanlatkeres.ajanlatok.length < 2 && (
          <li>
            <form onSubmit={addAjanlat} className="mt-1 flex items-center gap-1">
              <input
                type="number"
                placeholder="Nettó"
                value={netto}
                onChange={(e) => setNetto(e.target.value)}
                className="w-20 rounded border border-[var(--border)] px-1 py-0.5 text-xs"
              />
              <select
                value={afaTipus}
                onChange={(e) => setAfaTipus(e.target.value)}
                className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
              >
                {Object.entries(VAT_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded border border-[var(--border)] px-1 py-0.5 text-xs">
                + Ajánlat
              </button>
            </form>
          </li>
        )}
      </ul>
    </li>
  );
}

function dayDiff(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function UtemezesTab({
  projekt,
  projektId,
  tetelek,
  szemelyek,
  onChange,
}: {
  projekt: ProjektDetail;
  projektId: number;
  tetelek: ProjektTetel[];
  szemelyek: Szemely[];
  onChange: () => void;
}) {
  const [deliveryDate, setDeliveryDate] = useState(projekt.delivery_date || "");
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  async function ganttPdf() {
    setError("");
    try {
      await downloadFile(`/projektek/${projektId}/gantt.pdf`, `${projekt.projekt_nev}_utemterv.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba a Gantt-diagram létrehozása során");
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = tetelek.findIndex((t) => t.id === active.id);
    const newIndex = tetelek.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...tetelek];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    await Promise.all(reordered.map((t, i) => api.updateTetel(projektId, t.id, { sorrend: i })));
    onChange();
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
        <button
          onClick={ganttPdf}
          className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          <Download size={14} /> Gantt PDF
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
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2">Tétel</th>
              <th className="px-3 py-2">Felelős</th>
              <th className="px-3 py-2">Kijelölve</th>
              <th className="px-3 py-2">Időtartam (nap)</th>
              <th className="px-3 py-2">Előkészítés (nap)</th>
              <th className="px-3 py-2">Terv</th>
              <th className="px-3 py-2">Várható</th>
              <th className="px-3 py-2">Tényleges</th>
              <th className="px-3 py-2">Függőségek</th>
            </tr>
          </thead>
          <tbody>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tetelek.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {tetelek.map((t) => (
                  <TetelUtemezesRow
                    key={t.id}
                    projektId={projektId}
                    tetel={t}
                    osszes={tetelek}
                    szemelyek={szemelyek}
                    onChange={onChange}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
  szemelyek,
  onChange,
}: {
  projektId: number;
  tetel: ProjektTetel;
  osszes: ProjektTetel[];
  szemelyek: Szemely[];
  onChange: () => void;
}) {
  const [duration, setDuration] = useState(tetel.duration_days != null ? String(tetel.duration_days) : "");
  const [prep, setPrep] = useState(String(tetel.prep_days));
  const [tenylegesKezdes, setTenylegesKezdes] = useState(tetel.tenyleges_kezdes || "");
  const [tenylegesBefejezes, setTenylegesBefejezes] = useState(tetel.tenyleges_befejezes || "");
  const [addPrereq, setAddPrereq] = useState("");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tetel.id });

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
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="border-t border-[var(--border)] align-top"
    >
      <td className="px-2 py-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab text-[var(--muted)]">
          <GripVertical size={14} />
        </button>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{tetel.munkanem.nev}</td>
      <td className="px-3 py-2">
        <select
          value={tetel.felelos_szerep || ""}
          onChange={async (e) => {
            await api.updateTetel(projektId, tetel.id, { felelos_szerep: e.target.value || null });
            onChange();
          }}
          className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
        >
          <option value="">—</option>
          {Object.entries(SZEREP_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          value={tetel.kijelolt_id || ""}
          onChange={async (e) => {
            await api.updateTetel(projektId, tetel.id, {
              kijelolt_id: e.target.value ? Number(e.target.value) : null,
            });
            onChange();
          }}
          className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
        >
          <option value="">Nincs kijelölve</option>
          {szemelyek.map((sz) => (
            <option key={sz.id} value={sz.id}>
              {sz.nev}
            </option>
          ))}
        </select>
      </td>
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

const SABLON_TIPUS_LABEL: Record<string, string> = {
  ajanlatkeres: "Ajánlatkérés",
  ajanlat: "Ajánlat",
  megrendeles: "Megrendelés",
  szerzodes: "Szerződés",
  tig: "Teljesítésigazolás (TIG)",
};

function EmailKuldesPanel({ projektId, tetelIds }: { projektId: number; tetelIds: number[] }) {
  const [tipus, setTipus] = useState("ajanlat");
  const [cimzett, setCimzett] = useState("");
  const [uzenet, setUzenet] = useState("");
  const [elonezet, setElonezet] = useState<SablonElonezet | null>(null);
  const [emailek, setEmailek] = useState<KikuldottEmail[]>([]);
  const [error, setError] = useState("");
  const [siker, setSiker] = useState("");

  function loadEmailek() {
    api.listKikuldottEmailek(projektId).then(setEmailek).catch(() => {});
  }

  useEffect(() => {
    loadEmailek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projektId]);

  async function eloneznez() {
    setError("");
    setSiker("");
    if (tetelIds.length === 0) {
      setError("Jelölj ki legalább egy tételt a Tételek listájában (checkbox).");
      return;
    }
    try {
      const res = await api.sablonElonezet(projektId, { tipus, tetel_ids: tetelIds, uzenet: uzenet || null });
      setElonezet(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function kuldes(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSiker("");
    if (tetelIds.length === 0) {
      setError("Jelölj ki legalább egy tételt a Tételek listájában (checkbox).");
      return;
    }
    try {
      await api.kuldEmail(projektId, { tipus, tetel_ids: tetelIds, cimzett, uzenet: uzenet || null });
      setSiker(`Elküldve: ${cimzett}`);
      setCimzett("");
      setUzenet("");
      setElonezet(null);
      loadEmailek();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <div className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="mb-2 font-heading font-semibold">Dokumentum / levél küldése</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Jelöld ki a tétel(eke)t fent a listában, válaszd ki a sablont, és küldd el. Az e-mail dev módban
        Mailpit-re megy (nem valódi címre).
      </p>
      <form onSubmit={kuldes} className="grid max-w-xl grid-cols-1 gap-2">
        <select
          value={tipus}
          onChange={(e) => setTipus(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        >
          {Object.entries(SABLON_TIPUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input
          type="email"
          placeholder="Címzett e-mail címe"
          required
          value={cimzett}
          onChange={(e) => setCimzett(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        />
        <textarea
          placeholder="Kiegészítő üzenet (opcionális)"
          value={uzenet}
          onChange={(e) => setUzenet(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={eloneznez}
            className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm"
          >
            Előnézet
          </button>
          <button
            type="submit"
            className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]"
          >
            Küldés
          </button>
        </div>
      </form>

      {error && <div className="mt-3 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      {siker && <div className="mt-3 rounded-[var(--radius)] bg-[var(--color-accent-100)] px-3 py-2 text-sm">{siker}</div>}

      {elonezet && (
        <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Tárgy: {elonezet.targy}</p>
          <div dangerouslySetInnerHTML={{ __html: elonezet.html }} />
        </div>
      )}

      {emailek.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1 text-sm font-semibold">Korábban elküldött levelek</h4>
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {emailek.map((e) => (
              <li key={e.id}>
                {new Date(e.elkuldve_at).toLocaleString("hu-HU")} — {SABLON_TIPUS_LABEL[e.tipus] || e.tipus} →{" "}
                {e.cimzett} ({e.targy})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const DOKUMENTUM_TIPUS_LABEL: Record<string, string> = {
  szerzodes: "Szerződés",
  tervrajz: "Tervrajz",
  engedely: "Engedély",
  fenykep: "Fénykép",
  egyeb: "Egyéb",
};

function formatMeret(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DokumentumokTab({
  projektId,
  dokumentumok,
  onChange,
}: {
  projektId: number;
  dokumentumok: Dokumentum[];
  onChange: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [tipus, setTipus] = useState("egyeb");
  const [megjegyzes, setMegjegyzes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [feltoltes, setFeltoltes] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setFeltoltes(true);
    try {
      await api.uploadDokumentum(projektId, { tipus, megjegyzes: megjegyzes || undefined, file });
      setTipus("egyeb");
      setMegjegyzes("");
      setFile(null);
      setShowModal(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba a feltöltés során");
    } finally {
      setFeltoltes(false);
    }
  }

  async function handleDelete(dok: Dokumentum) {
    if (!confirm(`Biztosan törlöd: ${dok.eredeti_nev || "dokumentum"}?`)) return;
    await api.deleteDokumentum(projektId, dok.id);
    onChange();
  }

  return (
    <div className="max-w-2xl">
      <button
        type="button"
        onClick={() => {
          setError("");
          setShowModal(true);
        }}
        className="mb-4 flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]"
      >
        <Plus size={14} /> Dokumentum feltöltése
      </button>

      {showModal && (
        <Modal title="Dokumentum feltöltése" onClose={() => setShowModal(false)}>
          <form onSubmit={handleUpload} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Típus</label>
              <select
                value={tipus}
                onChange={(e) => setTipus(e.target.value)}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              >
                {Object.entries(DOKUMENTUM_TIPUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Megjegyzés (opcionális)</label>
              <input
                value={megjegyzes}
                onChange={(e) => setMegjegyzes(e.target.value)}
                placeholder="Megjegyzés (opcionális)"
                className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fájl</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" required />
              <p className="text-xs text-[var(--muted)]">
                Engedélyezett típusok: pdf, doc(x), xls(x), jpg, png, dwg, zip, txt — max. 25 MB.
              </p>
            </div>
            {error && <div className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-[var(--radius)] px-3 py-1.5 text-sm text-[var(--muted)]">
                Mégse
              </button>
              <button
                type="submit"
                disabled={!file || feltoltes}
                className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] disabled:opacity-60"
              >
                <Plus size={14} /> {feltoltes ? "Feltöltés..." : "Feltöltés"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {dokumentumok.map((dok) => (
          <li key={dok.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{dok.eredeti_nev || "(névtelen fájl)"}</div>
              <div className="text-xs text-[var(--muted)]">
                {DOKUMENTUM_TIPUS_LABEL[dok.tipus] || dok.tipus} · {formatMeret(dok.meret)} ·{" "}
                {new Date(dok.created_at).toLocaleDateString("hu-HU")}
                {dok.megjegyzes ? ` · ${dok.megjegyzes}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => api.downloadDokumentum(projektId, dok.id, dok.eredeti_nev || `dokumentum-${dok.id}`)}
                className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs"
              >
                <Download size={12} /> Letöltés
              </button>
              <button onClick={() => handleDelete(dok)} className="text-[var(--danger)]">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
        {dokumentumok.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Nincs még feltöltött dokumentum.</li>
        )}
      </ul>
    </div>
  );
}
