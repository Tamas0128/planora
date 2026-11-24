"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Modal from "@/components/Modal";
import { Feladat, api, NaptarEsemeny } from "@/lib/api";

const HONAPOK = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];
const NAPOK = ["Hé", "Ke", "Sze", "Cs", "Pé", "Szo", "Va"];

const TIPUS_LABEL: Record<NaptarEsemeny["tipus"], string> = {
  feladat: "Feladat",
  atadas: "Átadás",
  tetel: "Ütemezett tétel",
  garancia: "Garancia lejár",
};
// A típust a címke szövege és a jelölő forma is hordozza, nem csak a szín.
const TIPUS_STIL: Record<NaptarEsemeny["tipus"], string> = {
  feladat: "border-[var(--color-neutral-500)] bg-[var(--card)]",
  atadas: "border-[var(--primary)] bg-[var(--color-accent-100)] font-semibold",
  tetel: "border-transparent bg-[var(--color-neutral-300)]",
  garancia: "border-dashed border-[var(--critical)] bg-[var(--critical-bg)]",
};

// A többnapos tétel a rácsban folytonos sávként látszik: a szöveg csak az első napon és hétfőnként jelenik meg.
const rovidCim = (e: NaptarEsemeny) => (e.tipus === "tetel" && e.cim.includes(": ") ? e.cim.slice(e.cim.lastIndexOf(": ") + 2) : e.cim);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const selCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm";

// Havi naptár (a Planora nézete alapján): hónap/év választó, „Ma" gomb, jelmagyarázat, napi lista.
// `projektId` megadásakor csak az adott projekt eseményeit mutatja.
export default function NaptarNezet({ projektId }: { projektId?: number }) {
  const [ev, setEv] = useState(() => {
    const m = new Date();
    return new Date(m.getFullYear(), m.getMonth(), 1);
  });
  const [esemenyek, setEsemenyek] = useState<NaptarEsemeny[]>([]);
  const [error, setError] = useState("");
  const [kivalasztott, setKivalasztott] = useState<string | null>(null);
  const [reszlet, setReszlet] = useState<NaptarEsemeny | null>(null);
  const [frissit, setFrissit] = useState(0);

  // A hónap rácsa hétfővel kezdődik, ezért a tartomány a teljes látható rácsot lefedi.
  const napok = useMemo(() => {
    const elso = new Date(ev.getFullYear(), ev.getMonth(), 1);
    const eltolas = (elso.getDay() + 6) % 7;
    const kezdet = new Date(ev.getFullYear(), ev.getMonth(), 1 - eltolas);
    const utolso = new Date(ev.getFullYear(), ev.getMonth() + 1, 0);
    const darab = Math.ceil((eltolas + utolso.getDate()) / 7) * 7;
    return Array.from({ length: darab }, (_, i) => new Date(kezdet.getFullYear(), kezdet.getMonth(), kezdet.getDate() + i));
  }, [ev]);

  const tol = iso(napok[0]);
  const ig = iso(napok[napok.length - 1]);

  useEffect(() => {
    api
      .getNaptar(tol, ig, projektId)
      .then((r) => {
        setEsemenyek(r);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [tol, ig, projektId, frissit]);

  const napiEsemenyek = (nap: string) => esemenyek.filter((e) => e.kezdes <= nap && e.vege >= nap);
  const ma = iso(new Date());
  const honapElso = iso(new Date(ev.getFullYear(), ev.getMonth(), 1));
  const honapUtolso = iso(new Date(ev.getFullYear(), ev.getMonth() + 1, 0));
  const lista = kivalasztott ? napiEsemenyek(kivalasztott) : esemenyek.filter((e) => e.vege >= honapElso && e.kezdes <= honapUtolso);
  const evek = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i);

  function lepes(d: number) {
    setEv(new Date(ev.getFullYear(), ev.getMonth() + d, 1));
    setKivalasztott(null);
  }

  return (
    <div>
      {error && <div role="alert" className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold" aria-live="polite">
          {ev.getFullYear()}. {HONAPOK[ev.getMonth()].toLowerCase()}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`nap-honap-${projektId ?? "mind"}`}>Hónap</label>
          <select
            id={`nap-honap-${projektId ?? "mind"}`}
            value={ev.getMonth()}
            onChange={(e) => {
              setEv(new Date(ev.getFullYear(), Number(e.target.value), 1));
              setKivalasztott(null);
            }}
            className={selCls}
          >
            {HONAPOK.map((n, i) => (
              <option key={n} value={i}>{n}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`nap-ev-${projektId ?? "mind"}`}>Év</label>
          <select
            id={`nap-ev-${projektId ?? "mind"}`}
            value={ev.getFullYear()}
            onChange={(e) => {
              setEv(new Date(Number(e.target.value), ev.getMonth(), 1));
              setKivalasztott(null);
            }}
            className={selCls}
          >
            {evek.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => {
              const m = new Date();
              setEv(new Date(m.getFullYear(), m.getMonth(), 1));
              setKivalasztott(iso(m));
            }}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
          >
            Ma
          </button>
          <button aria-label="Előző hónap" onClick={() => lepes(-1)} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-black/5 md:h-9 md:w-9">
            <ChevronLeft size={16} />
          </button>
          <button aria-label="Következő hónap" onClick={() => lepes(1)} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-black/5 md:h-9 md:w-9">
            <ChevronRight size={16} />
          </button>
          {!projektId && (
            <button
              onClick={() => api.downloadNaptarIcs().catch((e) => setError(e.message))}
              className="ml-1 flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm"
            >
              <Download size={14} /> iCal exportálás (.ics)
            </button>
          )}
        </div>
      </div>

      <ul className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-label="Jelmagyarázat">
        {(Object.keys(TIPUS_LABEL) as NaptarEsemeny["tipus"][]).map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-4 rounded-sm border ${TIPUS_STIL[t]} ${(t === "feladat" || t === "tetel") ? "!border-[var(--muted)]" : ""}`} aria-hidden="true" />
            {TIPUS_LABEL[t]}
          </li>
        ))}
      </ul>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)]" role="grid" aria-label="Hónap naptár">
        <div role="row" className="grid grid-cols-7 gap-px">
          {NAPOK.map((n, i) => (
            <div key={n} role="columnheader" className={`bg-[var(--card)] py-1.5 text-center text-xs font-semibold uppercase tracking-wide ${i >= 5 ? "text-[var(--muted)]/70" : "text-[var(--muted)]"}`}>
              {n}
            </div>
          ))}
        </div>
        {Array.from({ length: napok.length / 7 }, (_, het) => (
          <div key={het} role="row" className="mt-px grid grid-cols-7 gap-px">
            {napok.slice(het * 7, het * 7 + 7).map((d) => {
              const k = iso(d);
              const ebben = d.getMonth() === ev.getMonth();
              const napi = napiEsemenyek(k);
              return (
                <div
                  key={k}
                  role="gridcell"
                  aria-selected={kivalasztott === k}
                  onClick={() => setKivalasztott(kivalasztott === k ? null : k)}
                  className={`min-h-14 cursor-pointer p-1 text-left align-top md:min-h-24 ${ebben ? "bg-[var(--card)]" : "bg-[var(--background)] text-[var(--muted)]"} ${kivalasztott === k ? "outline outline-2 -outline-offset-2 outline-[var(--primary)]" : ""}`}
                >
                  <button
                    aria-label={`${k}, ${napi.length} esemény`}
                    aria-pressed={kivalasztott === k}
                    onClick={(ev2) => {
                      ev2.stopPropagation();
                      setKivalasztott(kivalasztott === k ? null : k);
                    }}
                    className="flex w-full justify-end"
                  >
                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full text-xs font-semibold ${k === ma ? "bg-[var(--primary)] px-1 text-[var(--primary-foreground)]" : ""}`}>{d.getDate()}</span>
                  </button>
                  <div className="mt-0.5 space-y-0.5 max-md:hidden">
                    {napi.slice(0, 3).map((e) => (
                      <button
                        key={e.kulcs}
                        type="button"
                        title={e.cim}
                        onClick={(ev2) => {
                          ev2.stopPropagation();
                          setReszlet(e);
                        }}
                        className={`block w-full truncate rounded border px-1 text-left text-xs hover:brightness-95 ${TIPUS_STIL[e.tipus]} ${e.kesz ? "line-through opacity-70" : ""}`}
                      >
                        {e.kezdes === e.vege || k === e.kezdes || d.getDay() === 1 ? rovidCim(e) : " "}
                      </button>
                    ))}
                    {napi.length > 3 && <span className="block text-xs text-[var(--muted)]">+{napi.length - 3} további</span>}
                  </div>
                  {napi.length > 0 && <span className="mt-1 block text-center text-xs font-medium md:hidden">{napi.length}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <section className="mt-4" aria-label="Események listája">
        <h3 className="mb-2 text-sm font-semibold">{kivalasztott ? `${kivalasztott} eseményei` : "A hónap eseményei"}</h3>
        {lista.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nincs esemény.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" data-testid="naptar-lista">
            {lista.map((e) => (
              <li key={e.kulcs} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <button type="button" onClick={() => setReszlet(e)} className={`text-left text-[var(--primary)] hover:underline ${e.kesz ? "line-through opacity-70" : ""}`}>
                  {e.cim}
                </button>
                <span className="text-[var(--muted)]">
                  {TIPUS_LABEL[e.tipus]} · {e.kezdes === e.vege ? e.kezdes : `${e.kezdes} – ${e.vege}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {reszlet && (
        <EsemenyModal
          esemeny={reszlet}
          onClose={() => setReszlet(null)}
          onChanged={() => setFrissit((n) => n + 1)}
        />
      )}
    </div>
  );
}

function EsemenyModal({ esemeny, onClose, onChanged }: { esemeny: NaptarEsemeny; onClose: () => void; onChanged: () => void }) {
  const [feladat, setFeladat] = useState<Feladat | null>(null);
  const [hiba, setHiba] = useState("");
  const feladatId = esemeny.tipus === "feladat" ? Number(esemeny.kulcs.split("-")[1]) : null;

  useEffect(() => {
    if (feladatId == null) return;
    api
      .listFeladatok(esemeny.projekt_id ? { projekt_id: esemeny.projekt_id } : undefined)
      .then((l) => setFeladat(l.find((f) => f.id === feladatId) ?? null))
      .catch((e) => setHiba(e.message));
  }, [feladatId, esemeny.projekt_id]);

  async function kesz(on: boolean) {
    if (!feladat) return;
    try {
      const f = await api.updateFeladat(feladat.id, { kesz: on });
      setFeladat({ ...feladat, kesz: f.kesz });
      onChanged();
    } catch (e) {
      setHiba(e instanceof Error ? e.message : "Hiba");
    }
  }

  return (
    <Modal title={TIPUS_LABEL[esemeny.tipus]} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <p className="text-base font-semibold">{esemeny.cim}</p>
        <p className="text-[var(--muted)]">{esemeny.kezdes === esemeny.vege ? esemeny.kezdes : `${esemeny.kezdes} – ${esemeny.vege}`}</p>
        {hiba && <p role="alert" className="text-[var(--danger)]">{hiba}</p>}
        {feladat && (
          <>
            {feladat.leiras && <p className="whitespace-pre-line">{feladat.leiras}</p>}
            <p className="text-[var(--muted)]">
              {feladat.felelos ? `Felelős: ${feladat.felelos.full_name}` : "Nincs felelős kijelölve"}
              {feladat.projekt_nev ? ` · ${feladat.projekt_nev}` : ""}
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={feladat.kesz} onChange={(e) => kesz(e.target.checked)} />
              Kész
            </label>
          </>
        )}
        {esemeny.projekt_id && (
          <Link href={`/projektek/${esemeny.projekt_id}`} className="inline-block rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-[var(--primary-foreground)]">
            Projekt megnyitása
          </Link>
        )}
      </div>
    </Modal>
  );
}
