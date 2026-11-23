"use client";

import { FormEvent, useCallback, useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AjanlatAllapot, AjanlatSor, AjanlatVerzio, api, VevoiAjanlat } from "@/lib/api";

const INPUT = "w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";
const CARD = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4";

const ALLAPOT_LABEL: Record<AjanlatAllapot, string> = {
  tervezet: "Tervezet",
  elkuldve: "Elküldve",
  elfogadva: "Elfogadva",
  elutasitva: "Lecserélve / elutasítva",
};

const ft = (n: number | string) => `${Math.round(Number(n)).toLocaleString("hu-HU")} Ft`;
const ures = (): AjanlatSor => ({ megnevezes: "", mennyiseg: 1, egyseg: "", egysegar: 0 });
const osszeg = (sorok: AjanlatSor[]) => sorok.reduce((s, r) => s + Number(r.mennyiseg) * Number(r.egysegar), 0);

function SorSzerkeszto({ sorok, onChange }: { sorok: AjanlatSor[]; onChange: (s: AjanlatSor[]) => void }) {
  const uid = useId();
  const set = (i: number, patch: Partial<AjanlatSor>) => onChange(sorok.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {sorok.map((s, i) => (
        <div key={i} className="grid grid-cols-[1fr_5rem_4rem_7rem_2.75rem] items-end gap-2 max-md:grid-cols-2">
          <div className="space-y-1 max-md:col-span-2">
            <label htmlFor={`${uid}-nev-${i}`} className="text-xs font-medium">Megnevezés</label>
            <input id={`${uid}-nev-${i}`} required className={INPUT} value={s.megnevezes} onChange={(e) => set(i, { megnevezes: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${uid}-mny-${i}`} className="text-xs font-medium">Menny.</label>
            <input id={`${uid}-mny-${i}`} type="number" min={0} step="any" className={INPUT} value={s.mennyiseg} onChange={(e) => set(i, { mennyiseg: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${uid}-egy-${i}`} className="text-xs font-medium">Egység</label>
            <input id={`${uid}-egy-${i}`} className={INPUT} value={s.egyseg || ""} onChange={(e) => set(i, { egyseg: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${uid}-ar-${i}`} className="text-xs font-medium">Egységár (Ft)</label>
            <input id={`${uid}-ar-${i}`} type="number" min={0} step="any" className={INPUT} value={s.egysegar} onChange={(e) => set(i, { egysegar: e.target.value })} />
          </div>
          <button
            type="button"
            aria-label="Sor törlése"
            disabled={sorok.length <= 1}
            onClick={() => onChange(sorok.filter((_, j) => j !== i))}
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-[var(--danger)] disabled:opacity-40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onChange([...sorok, ures()])} className="flex items-center gap-1 text-sm text-[var(--primary)]">
          <Plus size={14} /> Új sor
        </button>
        <span className="text-sm font-medium">Nettó összesen: {ft(osszeg(sorok))}</span>
      </div>
    </div>
  );
}

function VerzioDiff({ elozo, mostani }: { elozo: AjanlatVerzio; mostani: AjanlatVerzio }) {
  const e = new Map(elozo.sorok.map((s) => [s.megnevezes, s]));
  const m = new Map(mostani.sorok.map((s) => [s.megnevezes, s]));
  const valtozasok: string[] = [];
  m.forEach((s, nev) => {
    const r = e.get(nev);
    if (!r) valtozasok.push(`+ ${nev}: ${ft(Number(s.mennyiseg) * Number(s.egysegar))}`);
    else if (Number(r.mennyiseg) * Number(r.egysegar) !== Number(s.mennyiseg) * Number(s.egysegar))
      valtozasok.push(`~ ${nev}: ${ft(Number(r.mennyiseg) * Number(r.egysegar))} → ${ft(Number(s.mennyiseg) * Number(s.egysegar))}`);
  });
  e.forEach((s, nev) => {
    if (!m.has(nev)) valtozasok.push(`− ${nev}: ${ft(Number(s.mennyiseg) * Number(s.egysegar))}`);
  });
  const delta = Number(mostani.netto_osszeg) - Number(elozo.netto_osszeg);
  return (
    <div className="rounded-[var(--radius)] bg-black/5 p-2 text-xs" data-testid="verzio-diff">
      <div className="font-medium">
        Változás v{elozo.verzio} → v{mostani.verzio}: {delta >= 0 ? "+" : "−"}{ft(Math.abs(delta))}
      </div>
      {valtozasok.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {valtozasok.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AjanlatKartya({ a, onChange }: { a: VevoiAjanlat; onChange: () => void }) {
  const [szerk, setSzerk] = useState<AjanlatSor[] | null>(null);
  const [megj, setMegj] = useState("");
  const [error, setError] = useState("");
  const utolso = a.verziok[a.verziok.length - 1];

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  function ujVerzio(e: FormEvent) {
    e.preventDefault();
    if (!szerk) return;
    run(async () => {
      await api.ujAjanlatVerzio(a.id, { sorok: szerk, megjegyzes: megj || null });
      setSzerk(null);
      setMegj("");
    });
  }

  return (
    <article className={`${CARD} space-y-3`} aria-label={`Ajánlat: ${a.cim}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{a.cim}</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-[var(--radius)] bg-black/5 px-2 py-0.5 text-xs">
            v{utolso.verzio} · {ALLAPOT_LABEL[utolso.allapot]}
          </span>
          <strong>{ft(utolso.netto_osszeg)}</strong>
        </div>
      </div>
      {error && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      <ol className="space-y-3">
        {[...a.verziok].reverse().map((v, idx, arr) => {
          const elozo = arr[idx + 1];
          return (
            <li key={v.id} className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  v{v.verzio} · {new Date(v.created_at).toLocaleDateString("hu-HU")} · {ALLAPOT_LABEL[v.allapot]}
                </span>
                <span>{ft(v.netto_osszeg)}</span>
              </div>
              {v.megjegyzes && <p className="text-[var(--muted)]">{v.megjegyzes}</p>}
              {elozo && <VerzioDiff elozo={elozo} mostani={v} />}
              {v === utolso && (
                <>
                  <div tabIndex={0} className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-[var(--muted)]">
                        <tr>
                          <th className="py-1 pr-2 font-medium">Tétel</th>
                          <th className="py-1 pr-2 font-medium">Menny.</th>
                          <th className="py-1 pr-2 font-medium">Egységár</th>
                          <th className="py-1 text-right font-medium">Összeg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.sorok.map((s) => (
                          <tr key={s.id} className="border-t border-[var(--border)]">
                            <td className="py-1 pr-2">{s.megnevezes}</td>
                            <td className="py-1 pr-2">{Number(s.mennyiseg)} {s.egyseg}</td>
                            <td className="py-1 pr-2">{ft(s.egysegar)}</td>
                            <td className="py-1 text-right">{ft(Number(s.mennyiseg) * Number(s.egysegar))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {v.allapot === "tervezet" && (
                      <button onClick={() => run(() => api.setAjanlatAllapot(v.id, "elkuldve"))} className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs">
                        Megjelölés elküldöttként
                      </button>
                    )}
                    {(v.allapot === "tervezet" || v.allapot === "elkuldve") && (
                      <>
                        <button onClick={() => run(() => api.setAjanlatAllapot(v.id, "elfogadva"))} className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-xs text-[var(--primary-foreground)]">
                          Elfogadva
                        </button>
                        <button onClick={() => run(() => api.setAjanlatAllapot(v.id, "elutasitva"))} className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs">
                          Elutasítva
                        </button>
                      </>
                    )}
                    {v.allapot !== "elfogadva" && (
                      <button onClick={() => setSzerk(v.sorok.map((s) => ({ ...s })))} className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs">
                        Új verzió készítése
                      </button>
                    )}
                    <button
                      onClick={() => confirm("Törlöd az ajánlatot az összes verziójával?") && run(() => api.deleteAjanlat(a.id))}
                      className="ml-auto rounded-[var(--radius)] px-2 py-1 text-xs text-[var(--danger)]"
                    >
                      Törlés
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>

      {szerk && (
        <form onSubmit={ujVerzio} className="space-y-3 border-t border-[var(--border)] pt-3" aria-label="Új verzió">
          <h4 className="text-sm font-semibold">Új verzió (v{utolso.verzio + 1})</h4>
          <SorSzerkeszto sorok={szerk} onChange={setSzerk} />
          <div className="space-y-1">
            <label htmlFor={`aj-megj-${a.id}`} className="text-sm font-medium">Mi változott?</label>
            <input id={`aj-megj-${a.id}`} className={INPUT} value={megj} onChange={(e) => setMegj(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">Verzió mentése</button>
            <button type="button" onClick={() => setSzerk(null)} className="px-3 py-1.5 text-sm text-[var(--muted)]">Mégse</button>
          </div>
        </form>
      )}
    </article>
  );
}

export default function AjanlatTab({ projektId }: { projektId: number }) {
  const [lista, setLista] = useState<VevoiAjanlat[]>([]);
  const [error, setError] = useState("");
  const [cim, setCim] = useState("");
  const [sorok, setSorok] = useState<AjanlatSor[]>([ures()]);

  const load = useCallback(() => {
    api.listAjanlatok(projektId).then(setLista).catch((e) => setError(e.message));
  }, [projektId]);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createAjanlat(projektId, { cim, sorok });
      setCim("");
      setSorok([ures()]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,32rem)_1fr]">
      {error && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)] xl:col-span-2">{error}</div>}
      <form onSubmit={create} className={`${CARD} h-fit space-y-3`} aria-label="Új ajánlat">
        <h2 className="text-sm font-semibold">Új vevői ajánlat</h2>
        <div className="space-y-1">
          <label htmlFor="aj-cim" className="text-sm font-medium">Ajánlat címe</label>
          <input id="aj-cim" required className={INPUT} value={cim} onChange={(e) => setCim(e.target.value)} />
        </div>
        <SorSzerkeszto sorok={sorok} onChange={setSorok} />
        <button className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">Ajánlat létrehozása (v1)</button>
      </form>
      <section className="space-y-3" aria-label="Ajánlatok" data-testid="ajanlat-lista">
        {lista.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Még nincs ajánlat ehhez a projekthez.</p>
        ) : (
          lista.map((a) => <AjanlatKartya key={a.id} a={a} onChange={load} />)
        )}
      </section>
    </div>
  );
}
