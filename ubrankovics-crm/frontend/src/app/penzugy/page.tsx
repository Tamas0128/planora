"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Morzsa from "@/components/Morzsa";
import CashflowChart from "@/components/CashflowChart";
import BankkivonatImport from "@/components/BankkivonatImport";
import {
  AlvallalkozoiSzamla,
  CashflowBucket,
  CashflowItem,
  CashflowRolling,
  ProjektListItem,
  Szerzodes,
  SzerzodesReszlet,
  Tig,
  UgyfelSzamla,
  Ugyfel,
  Alvallalkozo,
  TervezettBerkoltseg,
  BankEgyenleg,
  api,
} from "@/lib/api";

const inputCls = "rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";
const btnCls =
  "flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] disabled:opacity-60";
const cardCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]";

function huf(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toLocaleString("hu-HU")} Ft`;
}

export default function PenzugyPage() {
  const [tab, setTab] = useState<"cashflow" | "szerzodesek" | "szamlak" | "berkoltseg">("cashflow");
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- az URL csak kliensen olvasható
    if (v === "szerzodesek" || v === "szamlak" || v === "berkoltseg") setTab(v);
  }, []);

  return (
    <AppLayout>
      <Morzsa elemek={[{ cimke: "Pénzügy", href: "/penzugy" }, { cimke: { cashflow: "Teljes cash flow", szerzodesek: "Szerződések", szamlak: "TIG + számlák", berkoltseg: "Bérköltség" }[tab] }]} />
      <h1 className="mb-4 text-xl font-semibold">Pénzügy</h1>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {(
          [
            ["cashflow", "Teljes cash flow"],
            ["szerzodesek", "Szerződések"],
            ["szamlak", "TIG + számlák"],
            ["berkoltseg", "Bérköltség"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === v ? "border-b-2 border-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "cashflow" && <CashflowTab />}
      {tab === "szerzodesek" && <SzerzodesekTab />}
      {tab === "szamlak" && <SzamlakTab />}
      {tab === "berkoltseg" && <BerkoltsegTab />}
    </AppLayout>
  );
}

// --- Cash flow előrejelzés --------------------------------------------------

function useProjektOptions() {
  const [projektek, setProjektek] = useState<ProjektListItem[]>([]);
  useEffect(() => {
    api.listProjektek().then(setProjektek).catch(() => {});
  }, []);
  return projektek;
}

/** Amíg nincs projekt kiválasztva: a legfrissebb projektek egy kattintásra, hogy ne üres oldal fogadjon. */
function ProjektGyorsvalasztas({ projektek, mire, onValaszt }: { projektek: ProjektListItem[]; mire: string; onValaszt: (id: number) => void }) {
  const friss = [...projektek].sort((a, b) => b.id - a.id).slice(0, 8);
  return (
    <section aria-label="Projekt kiválasztása" className={`${cardCls} max-w-xl p-4`}>
      <h2 className="mb-1 text-sm font-semibold">Melyik projekt {mire}?</h2>
      <p className="mb-3 text-sm text-[var(--muted)]">Válassz a legutóbbiak közül, vagy a fenti listából.</p>
      <ul className="flex flex-wrap gap-2">
        {friss.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onValaszt(p.id)} className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm hover:border-[var(--primary)] md:min-h-9">
              {p.projekt_nev}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function isoDate(d: Date) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

interface Preset {
  label: string;
  range: (now: Date) => [Date, Date, ("het" | "honap")?];
}
const PRESETS: Preset[] = [
  { label: "Következő 13 hét", range: (n) => [n, addDays(n, 13 * 7 - 1), "het"] },
  { label: "Következő 26 hét", range: (n) => [n, addDays(n, 26 * 7 - 1), "het"] },
  { label: "Ez a negyedév", range: (n) => { const q = Math.floor(n.getMonth() / 3) * 3; return [new Date(n.getFullYear(), q, 1), new Date(n.getFullYear(), q + 3, 0), "het"]; } },
  { label: "Idén", range: (n) => [new Date(n.getFullYear(), 0, 1), new Date(n.getFullYear(), 11, 31), "honap"] },
  { label: "Következő 12 hónap", range: (n) => [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 12, 0), "honap"] },
];

function CashflowTab() {
  const projektek = useProjektOptions();
  const [bucket, setBucket] = useState<"het" | "honap">("het");
  const [tol, setTol] = useState(() => isoDate(new Date()));
  const [ig, setIg] = useState(() => isoDate(addDays(new Date(), 13 * 7 - 1)));
  const [projektId, setProjektId] = useState<number | "">("");
  const [data, setData] = useState<CashflowRolling | null>(null);
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get("projekt"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- az URL csak kliensen olvasható
    if (Number.isFinite(v) && v > 0) setProjektId(v);
  }, []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<CashflowItem[]>([]);
  const [snapshots, setSnapshots] = useState<BankEgyenleg[]>([]);
  const [periodError, setPeriodError] = useState("");
  const [snapDatum, setSnapDatum] = useState("");
  const [snapEgyenleg, setSnapEgyenleg] = useState("");

  function load() {
    api
      .getRollingCashflow({ bucket, tol, ig, projekt_id: projektId === "" ? undefined : projektId })
      .then((d) => {
        setData(d);
        setPeriodError("");
      })
      .catch((err) => setPeriodError(err instanceof Error ? err.message : "Hiba"));
  }
  useEffect(() => {
    if (!tol || !ig) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, tol, ig, projektId]);

  function preset(p: Preset) {
    const now = new Date();
    const [a, b, bk] = p.range(now);
    setTol(isoDate(a));
    setIg(isoDate(b));
    if (bk) setBucket(bk);
  }
  useEffect(() => {
    api.listBankegyenleg().then(setSnapshots).catch(() => {});
  }, []);

  async function toggleBucket(b: CashflowBucket) {
    if (expanded === b.kezdo_datum) {
      setExpanded(null);
      return;
    }
    const its = await api.getRollingCashflowItems({
      bucket,
      tol,
      ig,
      projekt_id: projektId === "" ? undefined : projektId,
      kezdo_datum: b.kezdo_datum,
    });
    setItems(its);
    setExpanded(b.kezdo_datum);
  }

  async function saveSnapshot(e: FormEvent) {
    e.preventDefault();
    if (!snapDatum || !snapEgyenleg) return;
    await api.createBankegyenleg({ datum: snapDatum, egyenleg: snapEgyenleg });
    setSnapDatum("");
    setSnapEgyenleg("");
    api.listBankegyenleg().then(setSnapshots).catch(() => {});
    load();
  }

  const anyNegative = useMemo(() => data?.bucketek.some((b) => b.negativ) ?? false, [data]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Időszak beosztása</span>
          <select value={bucket} onChange={(e) => setBucket(e.target.value as "het" | "honap")} className={inputCls}>
            <option value="het">Hét</option>
            <option value="honap">Hónap</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Időszak kezdete</span>
          <input type="date" value={tol} onChange={(e) => setTol(e.target.value)} className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Időszak vége</span>
          <input type="date" value={ig} min={tol} onChange={(e) => setIg(e.target.value)} className={inputCls} />
        </label>
        <label className="min-w-0 max-w-full text-sm">
          <span className="mb-1 block text-[var(--muted)]">Projekt</span>
          <select
            value={projektId}
            onChange={(e) => setProjektId(e.target.value === "" ? "" : Number(e.target.value))}
            className={`${inputCls} max-w-full`}
          >
            <option value="">Összes (cégszint)</option>
            {projektek.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projekt_nev}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Gyors időszakválasztás">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => preset(p)}
            className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {p.label}
          </button>
        ))}
      </div>
      {periodError && (
        <div role="alert" className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {periodError}
        </div>
      )}

      <form onSubmit={saveSnapshot} className={`${cardCls} mb-4 flex flex-wrap items-end gap-2 p-3`}>
        <div className="text-sm font-medium">Bankegyenleg rögzítése</div>
        <input aria-label="Egyenleg dátuma" type="date" value={snapDatum} onChange={(e) => setSnapDatum(e.target.value)} className={inputCls} required />
        <input
          placeholder="Egyenleg (Ft)"
          value={snapEgyenleg}
          onChange={(e) => setSnapEgyenleg(e.target.value)}
          className={`${inputCls} w-40`}
          required
        />
        <button type="submit" className={btnCls}>
          <Plus size={14} /> Mentés
        </button>
        {snapshots[0] && (
          <span className="ml-auto text-sm text-[var(--muted)]">
            Legutóbbi rögzített egyenleg: {huf(snapshots[0].egyenleg)} ({snapshots[0].datum})
          </span>
        )}
        <BankkivonatImport onApplied={load} />
      </form>

      {anyNegative && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          Likviditási kockázat: a horizonton belül legalább egy bucket záró egyenlege negatívra fordul.
        </div>
      )}

      {!data ? (
        <p className="text-sm text-[var(--muted)]">Betöltés…</p>
      ) : (
        <>
        <div className="mb-4">
          <CashflowChart bucketek={data.bucketek} />
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Számlázott: már kiállított vagy beérkezett számla, amely még nincs kifizetve. A lejárt, ki nem fizetett számlák az első időszakban szerepelnek, mert a pénzmozgás még hátravan. Tervezett: szerződés-részlet vagy jóváhagyott rendelés alapján várható tétel.
        </p>
        <div tabIndex={0} className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2">Időszak</th>
                <th className="px-2 py-2 text-right">Nyitó</th>
                <th className="px-2 py-2 text-right">Számlázott bevétel</th>
                <th className="px-2 py-2 text-right">Tervezett bevétel</th>
                <th className="px-2 py-2 text-right">Számlázott kiadás</th>
                <th className="px-2 py-2 text-right">Tervezett kiadás</th>
                <th className="px-2 py-2 text-right">Záró</th>
              </tr>
            </thead>
            <tbody>
              {data.bucketek.map((b) => (
                <Fragment key={b.kezdo_datum}>
                  <tr
                    onClick={() => toggleBucket(b)}
                    className={`cursor-pointer border-b border-[var(--border)] last:border-b-0 hover:bg-black/5 ${
                      b.negativ ? "bg-[var(--danger-bg)]" : ""
                    }`}
                  >
                    <td className="px-2 py-2">
                      {expanded === b.kezdo_datum ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-2 py-2">
                      {b.kezdo_datum} – {b.vege_datum}
                    </td>
                    <td className="px-2 py-2 text-right">{huf(b.nyito)}</td>
                    <td className="px-2 py-2 text-right text-[var(--positive)]">{huf(b.bevetel_teny)}</td>
                    <td className="px-2 py-2 text-right italic text-[var(--positive)]">{huf(b.bevetel_terv)}</td>
                    <td className="px-2 py-2 text-right text-[var(--danger)]">{huf(b.kiadas_teny)}</td>
                    <td className="px-2 py-2 text-right italic text-[var(--danger)]">{huf(b.kiadas_terv)}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${b.negativ ? "text-[var(--danger)]" : ""}`}>
                      {huf(b.zaro)}
                    </td>
                  </tr>
                  {expanded === b.kezdo_datum && (
                    <tr className="border-b border-[var(--border)] bg-black/[0.02]">
                      <td colSpan={8} className="px-4 py-2">
                        {items.length === 0 ? (
                          <span className="text-[var(--muted)]">Nincs tétel ebben az időszakban.</span>
                        ) : (
                          <ul className="space-y-1">
                            {items.map((it, i) => (
                              <li key={i} className="flex justify-between gap-4">
                                <span>
                                  {it.leiras}{" "}
                                  <span className="text-[var(--muted)]">
                                    ({it.irany === "bevetel" ? "bevétel" : "kiadás"},{" "}
                                    {it.reteg === "teny" ? "tényleges" : "tervezett"}
                                    {it.lejart ? ", lejárt" : ""})
                                  </span>
                                </span>
                                <span className={it.irany === "bevetel" ? "text-[var(--positive)]" : "text-[var(--danger)]"}>
                                  {huf(it.osszeg)} · {it.esedekesseg}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

// --- Szerződések -------------------------------------------------------------

function SzerzodesekTab() {
  const projektek = useProjektOptions();
  const [projektId, setProjektId] = useState<number | "">("");
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get("projekt"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- az URL csak kliensen olvasható
    if (Number.isFinite(v) && v > 0) setProjektId(v);
  }, []);
  const [ugyfelek, setUgyfelek] = useState<Ugyfel[]>([]);
  const [szerzodesek, setSzerzodesek] = useState<Szerzodes[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [ugyfelId, setUgyfelId] = useState<number | "">("");
  const [szam, setSzam] = useState("");
  const [osszeg, setOsszeg] = useState("");
  const [afaTipus, setAfaTipus] = useState("afa_27");
  const [kezdes, setKezdes] = useState("");
  const [befejezes, setBefejezes] = useState("");
  const [reszletek, setReszletek] = useState<{ megnevezes: string; osszeg: string; esedekesseg: string }[]>([]);

  useEffect(() => {
    api.listUgyfelek().then(setUgyfelek).catch(() => {});
  }, []);

  function load(pid: number | "") {
    if (pid === "") return;
    api.listSzerzodesek(pid).then(setSzerzodesek).catch(() => {});
  }
  useEffect(() => {
    load(projektId);
  }, [projektId]);

  function addReszletRow() {
    setReszletek([...reszletek, { megnevezes: "", osszeg: "", esedekesseg: "" }]);
  }
  function updateReszletRow(i: number, patch: Partial<{ megnevezes: string; osszeg: string; esedekesseg: string }>) {
    setReszletek(reszletek.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeReszletRow(i: number) {
    setReszletek(reszletek.filter((_, idx) => idx !== i));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (projektId === "" || ugyfelId === "" || !szam || !osszeg || !kezdes || !befejezes) return;
    await api.createSzerzodes(projektId as number, {
      ugyfel_id: ugyfelId,
      szerzodesszam: szam,
      osszeg,
      afa_tipus: afaTipus,
      kezdes,
      befejezes,
      reszletek: reszletek.filter((r) => r.megnevezes && r.osszeg && r.esedekesseg),
    });
    setSzam("");
    setOsszeg("");
    setKezdes("");
    setBefejezes("");
    setReszletek([]);
    setShowForm(false);
    load(projektId as number);
  }

  return (
    <div>
      <div className="mb-4">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Projekt</span>
          <select
            value={projektId}
            onChange={(e) => setProjektId(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputCls}
          >
            <option value="">Válassz projektet…</option>
            {projektek.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projekt_nev}
              </option>
            ))}
          </select>
        </label>
      </div>

      {projektId === "" && <ProjektGyorsvalasztas projektek={projektek} mire="szerződéseit nézzük" onValaszt={setProjektId} />}
      {projektId !== "" && (
        <>
          <button onClick={() => setShowForm((s) => !s)} className={`${btnCls} mb-3`}>
            <Plus size={14} /> Új szerződés
          </button>

          {showForm && (
            <form onSubmit={handleCreate} className={`${cardCls} mb-4 space-y-2 p-3`}>
              <div className="flex flex-wrap gap-2">
                <select value={ugyfelId} onChange={(e) => setUgyfelId(Number(e.target.value))} className={inputCls} required>
                  <option value="">Ügyfél…</option>
                  {ugyfelek.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nev}
                    </option>
                  ))}
                </select>
                <input placeholder="Szerződésszám" value={szam} onChange={(e) => setSzam(e.target.value)} className={inputCls} required />
                <input placeholder="Összeg (nettó, Ft)" value={osszeg} onChange={(e) => setOsszeg(e.target.value)} className={inputCls} required />
                <select value={afaTipus} onChange={(e) => setAfaTipus(e.target.value)} className={inputCls}>
                  <option value="afa_27">27%</option>
                  <option value="afa_5">5%</option>
                  <option value="afa_0">0%</option>
                  <option value="forditott">Fordított</option>
                </select>
                <input aria-label="Kezdés" type="date" value={kezdes} onChange={(e) => setKezdes(e.target.value)} className={inputCls} required />
                <input aria-label="Befejezés" type="date" value={befejezes} onChange={(e) => setBefejezes(e.target.value)} className={inputCls} required />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm text-[var(--muted)]">
                  <span>Ütemezett részletek (opcionális — a „tervezett bevétel” réteg forrása)</span>
                  <button type="button" onClick={addReszletRow} className="text-[var(--primary)]">
                    + Részlet
                  </button>
                </div>
                {reszletek.map((r, i) => (
                  <div key={i} className="mb-1 flex gap-2">
                    <input
                      placeholder="Megnevezés"
                      value={r.megnevezes}
                      onChange={(e) => updateReszletRow(i, { megnevezes: e.target.value })}
                      className={`${inputCls} flex-1`}
                    />
                    <input
                      placeholder="Összeg"
                      value={r.osszeg}
                      onChange={(e) => updateReszletRow(i, { osszeg: e.target.value })}
                      className={`${inputCls} w-32`}
                    />
                    <input aria-label="Részlet esedékessége"
                      type="date"
                      value={r.esedekesseg}
                      onChange={(e) => updateReszletRow(i, { esedekesseg: e.target.value })}
                      className={inputCls}
                    />
                    <button type="button" onClick={() => removeReszletRow(i)} className="text-sm text-[var(--danger)]">
                      Törlés
                    </button>
                  </div>
                ))}
              </div>

              <button type="submit" className={btnCls}>
                Szerződés létrehozása
              </button>
            </form>
          )}

          <div className="space-y-3">
            {szerzodesek.map((sz) => (
              <SzerzodesCard key={sz.id} szerzodes={sz} projektId={projektId as number} onChange={() => load(projektId as number)} />
            ))}
            {szerzodesek.length === 0 && <p className="text-sm text-[var(--muted)]">Nincs még szerződés ehhez a projekthez.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function SzerzodesCard({ szerzodes, projektId, onChange }: { szerzodes: Szerzodes; projektId: number; onChange: () => void }) {
  const [kiallitasFor, setKiallitasFor] = useState<number | null>(null);

  async function changeAllapot(allapot: string) {
    await api.updateSzerzodes(projektId, szerzodes.id, { allapot });
    onChange();
  }

  return (
    <div className={`${cardCls} p-3`}>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="font-medium">{szerzodes.szerzodesszam}</span>{" "}
          <span className="text-[var(--muted)]">— {szerzodes.ugyfel.nev}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)]">{huf(szerzodes.osszeg)}</span>
          <select
            value={szerzodes.allapot}
            onChange={(e) => changeAllapot(e.target.value)}
            className={`${inputCls} py-1`}
          >
            <option value="tervezet">Tervezet</option>
            <option value="aktiv">Aktív</option>
            <option value="teljesitett">Teljesített</option>
            <option value="torolt">Törölt</option>
          </select>
        </div>
      </div>
      {szerzodes.reszletek.length > 0 && (
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)] text-sm">
          {szerzodes.reszletek.map((r) => (
            <ReszletRow
              key={r.id}
              reszlet={r}
              projektId={projektId}
              szerzodesId={szerzodes.id}
              kiallitasOpen={kiallitasFor === r.id}
              onOpenKiallitas={() => setKiallitasFor(r.id)}
              onCloseKiallitas={() => setKiallitasFor(null)}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReszletRow({
  reszlet,
  projektId,
  szerzodesId,
  kiallitasOpen,
  onOpenKiallitas,
  onCloseKiallitas,
  onChange,
}: {
  reszlet: SzerzodesReszlet;
  projektId: number;
  szerzodesId: number;
  kiallitasOpen: boolean;
  onOpenKiallitas: () => void;
  onCloseKiallitas: () => void;
  onChange: () => void;
}) {
  const [szamlaszam, setSzamlaszam] = useState("");
  const [kiallitasDatum, setKiallitasDatum] = useState("");
  const [teljesitesDatum, setTeljesitesDatum] = useState("");
  const [esedekesseg, setEsedekesseg] = useState("");

  async function handleKiallit(e: FormEvent) {
    e.preventDefault();
    if (!szamlaszam || !kiallitasDatum || !teljesitesDatum || !esedekesseg) return;
    await api.kiallitSzamlaReszletbol(projektId, szerzodesId, reszlet.id, {
      szamlaszam,
      kiallitas_datum: kiallitasDatum,
      teljesites_datum: teljesitesDatum,
      esedekesseg,
    });
    onCloseKiallitas();
    onChange();
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between">
        <span>
          {reszlet.megnevezes} <span className="text-[var(--muted)]">({reszlet.esedekesseg})</span>
        </span>
        <div className="flex items-center gap-2">
          <span>{huf(reszlet.osszeg)}</span>
          {reszlet.kiallitott_szamla_id ? (
            <span className="text-xs text-[var(--positive)]">Számlázva (#{reszlet.kiallitott_szamla_id})</span>
          ) : (
            <button onClick={onOpenKiallitas} className="text-xs text-[var(--primary)]">
              Számla kiállítása
            </button>
          )}
        </div>
      </div>
      {kiallitasOpen && (
        <form onSubmit={handleKiallit} className="mt-2 flex flex-wrap items-end gap-2 rounded-[var(--radius)] bg-black/[0.03] p-2">
          <input placeholder="Számlaszám" value={szamlaszam} onChange={(e) => setSzamlaszam(e.target.value)} className={inputCls} required />
          <input aria-label="Kiállítás dátuma" type="date" value={kiallitasDatum} onChange={(e) => setKiallitasDatum(e.target.value)} className={inputCls} required />
          <input aria-label="Teljesítés dátuma" type="date" value={teljesitesDatum} onChange={(e) => setTeljesitesDatum(e.target.value)} className={inputCls} required />
          <input aria-label="Esedékesség" type="date" value={esedekesseg} onChange={(e) => setEsedekesseg(e.target.value)} className={inputCls} required />
          <button type="submit" className={btnCls}>
            Kiállítás
          </button>
          <button type="button" onClick={onCloseKiallitas} className="text-sm text-[var(--muted)]">
            Mégse
          </button>
        </form>
      )}
    </li>
  );
}

// --- TIG + számlák -----------------------------------------------------------

function SzamlakTab() {
  const projektek = useProjektOptions();
  const [projektId, setProjektId] = useState<number | "">("");
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get("projekt"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- az URL csak kliensen olvasható
    if (Number.isFinite(v) && v > 0) setProjektId(v);
  }, []);
  const [alvallalkozok, setAlvallalkozok] = useState<Alvallalkozo[]>([]);
  const [tigek, setTigek] = useState<Tig[]>([]);
  const [alvSzamlak, setAlvSzamlak] = useState<AlvallalkozoiSzamla[]>([]);
  const [ugySzamlak, setUgySzamlak] = useState<UgyfelSzamla[]>([]);

  useEffect(() => {
    api.listAlvallalkozok().then(setAlvallalkozok).catch(() => {});
  }, []);

  function load(pid: number | "") {
    if (pid === "") return;
    api.listTig(pid).then(setTigek).catch(() => {});
    api.listAlvallalkozoiSzamla(pid).then(setAlvSzamlak).catch(() => {});
    api.listUgyfelSzamla(pid).then(setUgySzamlak).catch(() => {});
  }
  useEffect(() => {
    load(projektId);
  }, [projektId]);

  const [netto, setNetto] = useState("");
  const [afaTipus, setAfaTipus] = useState("forditott");
  const [alvId, setAlvId] = useState<number | "">("");
  const [datum, setDatum] = useState("");
  const [idoszakKezdet, setIdoszakKezdet] = useState("");
  const [idoszakVeg, setIdoszakVeg] = useState("");

  async function createTig(e: FormEvent) {
    e.preventDefault();
    if (projektId === "" || alvId === "" || !datum || !idoszakKezdet || !idoszakVeg || !netto) return;
    await api.createTig(projektId as number, {
      alvallalkozo_id: alvId,
      datum,
      idoszak_kezdet: idoszakKezdet,
      idoszak_veg: idoszakVeg,
      netto,
      afa_tipus: afaTipus,
    });
    setNetto("");
    setDatum("");
    setIdoszakKezdet("");
    setIdoszakVeg("");
    load(projektId as number);
  }

  async function markAlvFizetve(sz: AlvallalkozoiSzamla) {
    await api.updateAlvallalkozoiSzamla(projektId as number, sz.id, {
      allapot: "kifizetve",
      fizetett_osszeg: sz.brutto,
      fizetes_datum: new Date().toISOString().slice(0, 10),
    });
    load(projektId as number);
  }

  async function markUgyfelFizetve(sz: UgyfelSzamla) {
    await api.updateUgyfelSzamla(projektId as number, sz.id, {
      allapot: "kifizetve",
      fizetett_osszeg: sz.brutto,
      fizetes_datum: new Date().toISOString().slice(0, 10),
    });
    load(projektId as number);
  }

  return (
    <div>
      <div className="mb-4">
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Projekt</span>
          <select
            value={projektId}
            onChange={(e) => setProjektId(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputCls}
          >
            <option value="">Válassz projektet…</option>
            {projektek.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projekt_nev}
              </option>
            ))}
          </select>
        </label>
      </div>

      {projektId === "" && <ProjektGyorsvalasztas projektek={projektek} mire="TIG-jeit és számláit nézzük" onValaszt={setProjektId} />}
      {projektId !== "" && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">TIG — Teljesítésigazolás</h2>
            <form onSubmit={createTig} className={`${cardCls} mb-3 flex flex-wrap items-end gap-2 p-3`}>
              <select value={alvId} onChange={(e) => setAlvId(Number(e.target.value))} className={inputCls} required>
                <option value="">Alvállalkozó…</option>
                {alvallalkozok.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nev}
                  </option>
                ))}
              </select>
              <input aria-label="Dátum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={inputCls} required />
              <input aria-label="Időszak kezdete" type="date" value={idoszakKezdet} onChange={(e) => setIdoszakKezdet(e.target.value)} className={inputCls} required />
              <input type="date" value={idoszakVeg} onChange={(e) => setIdoszakVeg(e.target.value)} className={inputCls} required />
              <input placeholder="Nettó (Ft)" value={netto} onChange={(e) => setNetto(e.target.value)} className={`${inputCls} w-32`} required />
              <select value={afaTipus} onChange={(e) => setAfaTipus(e.target.value)} className={inputCls}>
                <option value="forditott">Fordított</option>
                <option value="afa_27">27%</option>
                <option value="afa_5">5%</option>
                <option value="afa_0">0%</option>
              </select>
              <button type="submit" className={btnCls}>
                <Plus size={14} /> TIG rögzítése
              </button>
            </form>
            <ul className={`${cardCls} divide-y divide-[var(--border)] text-sm`}>
              {tigek.map((t) => (
                <li key={t.id} className="flex justify-between px-3 py-2">
                  <span>
                    {t.alvallalkozo.nev} — {t.idoszak_kezdet}…{t.idoszak_veg}
                  </span>
                  <span>
                    {huf(t.brutto)} <span className="text-[var(--muted)]">({t.allapot})</span>
                  </span>
                </li>
              ))}
              {tigek.length === 0 && <li className="px-3 py-4 text-center text-[var(--muted)]">Nincs még TIG.</li>}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Alvállalkozói számlák</h2>
            <AlvSzamlaForm projektId={projektId as number} alvallalkozok={alvallalkozok} tigek={tigek} onCreated={() => load(projektId as number)} />
            <ul className={`${cardCls} divide-y divide-[var(--border)] text-sm`}>
              {alvSzamlak.map((sz) => (
                <li key={sz.id} className="flex items-center justify-between px-3 py-2">
                  <span>
                    {sz.szamlaszam} — {sz.alvallalkozo.nev} <span className="text-[var(--muted)]">(esedékes: {sz.esedekesseg})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {huf(sz.hatralek)} hátralék / {huf(sz.brutto)}
                    {sz.allapot !== "kifizetve" && (
                      <button onClick={() => markAlvFizetve(sz)} className="text-xs text-[var(--primary)]">
                        Kifizetve
                      </button>
                    )}
                  </span>
                </li>
              ))}
              {alvSzamlak.length === 0 && <li className="px-3 py-4 text-center text-[var(--muted)]">Nincs még alvállalkozói számla.</li>}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Ügyfél számlák</h2>
            <ul className={`${cardCls} divide-y divide-[var(--border)] text-sm`}>
              {ugySzamlak.map((sz) => (
                <li key={sz.id} className="flex items-center justify-between px-3 py-2">
                  <span>
                    {sz.szamlaszam} — {sz.ugyfel.nev} <span className="text-[var(--muted)]">(esedékes: {sz.esedekesseg})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {huf(sz.hatralek)} hátralék / {huf(sz.brutto)}
                    {sz.allapot !== "kifizetve" && (
                      <button onClick={() => markUgyfelFizetve(sz)} className="text-xs text-[var(--primary)]">
                        Kifizetve
                      </button>
                    )}
                  </span>
                </li>
              ))}
              {ugySzamlak.length === 0 && (
                <li className="px-3 py-4 text-center text-[var(--muted)]">
                  Nincs még ügyfél számla (a „Szerződések” fülön szerződés-részletből is kiállítható).
                </li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function AlvSzamlaForm({
  projektId,
  alvallalkozok,
  tigek,
  onCreated,
}: {
  projektId: number;
  alvallalkozok: Alvallalkozo[];
  tigek: Tig[];
  onCreated: () => void;
}) {
  const [alvId, setAlvId] = useState<number | "">("");
  const [tigId, setTigId] = useState<number | "">("");
  const [szam, setSzam] = useState("");
  const [teljesites, setTeljesites] = useState("");
  const [kiallitas, setKiallitas] = useState("");
  const [esedekesseg, setEsedekesseg] = useState("");
  const [netto, setNetto] = useState("");
  const [afaTipus, setAfaTipus] = useState("forditott");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (alvId === "" || !szam || !teljesites || !kiallitas || !esedekesseg || !netto) return;
    await api.createAlvallalkozoiSzamla(projektId, {
      alvallalkozo_id: alvId,
      tig_id: tigId === "" ? null : tigId,
      szamlaszam: szam,
      teljesites_datum: teljesites,
      kiallitas_datum: kiallitas,
      esedekesseg,
      netto,
      afa_tipus: afaTipus,
    });
    setSzam("");
    setTeljesites("");
    setKiallitas("");
    setEsedekesseg("");
    setNetto("");
    onCreated();
  }

  return (
    <form onSubmit={handleCreate} className={`${cardCls} mb-3 flex flex-wrap items-end gap-2 p-3`}>
      <select value={alvId} onChange={(e) => setAlvId(Number(e.target.value))} className={inputCls} required>
        <option value="">Alvállalkozó…</option>
        {alvallalkozok.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nev}
          </option>
        ))}
      </select>
      <select value={tigId} onChange={(e) => setTigId(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls}>
        <option value="">TIG nélkül</option>
        {tigek.map((t) => (
          <option key={t.id} value={t.id}>
            TIG #{t.id} ({t.idoszak_kezdet}…{t.idoszak_veg})
          </option>
        ))}
      </select>
      <input placeholder="Számlaszám" value={szam} onChange={(e) => setSzam(e.target.value)} className={inputCls} required />
      <input type="date" placeholder="Teljesítés" value={teljesites} onChange={(e) => setTeljesites(e.target.value)} className={inputCls} required />
      <input type="date" placeholder="Kiállítás" value={kiallitas} onChange={(e) => setKiallitas(e.target.value)} className={inputCls} required />
      <input type="date" placeholder="Esedékesség" value={esedekesseg} onChange={(e) => setEsedekesseg(e.target.value)} className={inputCls} required />
      <input placeholder="Nettó (Ft)" value={netto} onChange={(e) => setNetto(e.target.value)} className={`${inputCls} w-32`} required />
      <select value={afaTipus} onChange={(e) => setAfaTipus(e.target.value)} className={inputCls}>
        <option value="forditott">Fordított</option>
        <option value="afa_27">27%</option>
        <option value="afa_5">5%</option>
        <option value="afa_0">0%</option>
      </select>
      <button type="submit" className={btnCls}>
        <Plus size={14} /> Számla rögzítése
      </button>
    </form>
  );
}

// --- Bérköltség ---------------------------------------------------------------

function BerkoltsegTab() {
  const [items, setItems] = useState<TervezettBerkoltseg[]>([]);
  const [honap, setHonap] = useState("");
  const [osszeg, setOsszeg] = useState("");

  function load() {
    api.listBerkoltsegek().then(setItems).catch(() => {});
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!honap || !osszeg) return;
    await api.createBerkoltseg({ honap: `${honap}-01`, osszeg });
    setHonap("");
    setOsszeg("");
    load();
  }

  return (
    <div className="max-w-xl">
      <p className="mb-2 text-sm text-[var(--muted)]">
        Cégszintű, havi bontású tervezett bérköltség — a gördülő cash-flow „tervezett kiadás” rétegének egyik forrása.
      </p>
      <form onSubmit={handleCreate} className="mb-3 flex gap-2">
        <input type="month" value={honap} onChange={(e) => setHonap(e.target.value)} className={inputCls} required />
        <input placeholder="Összeg (Ft)" value={osszeg} onChange={(e) => setOsszeg(e.target.value)} className={`${inputCls} flex-1`} required />
        <button type="submit" className={btnCls}>
          <Plus size={14} /> Hozzáad
        </button>
      </form>
      <ul className={`${cardCls} divide-y divide-[var(--border)]`}>
        {items.map((b) => (
          <li key={b.id} className="flex justify-between px-3 py-2 text-sm">
            <span>{b.honap.slice(0, 7)}</span>
            <span>{huf(b.osszeg)}</span>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Nincs még rögzített bérköltség.</li>}
      </ul>
    </div>
  );
}
