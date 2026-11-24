"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Alvallalkozo, ProjektTetel } from "@/lib/api";

/** A projekt végrehajtói a tételek vállalásai szerint, és a partnertörzs (alvállalkozók, gyártók, kivitelezők) kezelése. */
export default function PartnerekTab({ tetelek, onMegnyit }: { tetelek: ProjektTetel[]; onMegnyit: () => void }) {
  const [partnerek, setPartnerek] = useState<Alvallalkozo[]>([]);
  const [nev, setNev] = useState("");
  const [kapcsolat, setKapcsolat] = useState("");
  const [szerk, setSzerk] = useState<{ id: number; nev: string; kapcsolat: string } | null>(null);
  const [hiba, setHiba] = useState("");

  const betolt = () => api.listAlvallalkozok().then(setPartnerek).catch((e) => setHiba(e.message));
  useEffect(() => {
    betolt();
  }, []);

  const csoportok = new Map<string, { id?: number; tetelek: string[] }>();
  for (const t of tetelek) {
    for (const v of t.vallalasok) {
      const kulcs = v.tipus === "sajat" ? "Ubrankovics (saját)" : v.tipus === "ugyfel" ? "Ügyfél" : v.alvallalkozo?.nev || "Alvállalkozó (név nélkül)";
      const cur = csoportok.get(kulcs) ?? { id: v.alvallalkozo?.id, tetelek: [] };
      cur.tetelek.push(t.munkanem.nev);
      csoportok.set(kulcs, cur);
    }
  }
  const gyartok = tetelek.filter((t) => t.info && /Gyártó:|Beszállító:/.test(t.info));

  async function felvesz(e: React.FormEvent) {
    e.preventDefault();
    if (!nev.trim()) return;
    setHiba("");
    try {
      await api.createAlvallalkozo({ nev: nev.trim(), kapcsolat: kapcsolat.trim() || null });
      setNev("");
      setKapcsolat("");
      await betolt();
    } catch (err) {
      setHiba((err as Error).message);
    }
  }

  async function ment() {
    if (!szerk || !szerk.nev.trim()) return;
    setHiba("");
    try {
      await api.updateAlvallalkozo(szerk.id, { nev: szerk.nev.trim(), kapcsolat: szerk.kapcsolat.trim() || null });
      setSzerk(null);
      await betolt();
    } catch (err) {
      setHiba((err as Error).message);
    }
  }

  const mezo = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm";

  return (
    <div className="max-w-3xl space-y-6">
      <section aria-label="Ki végzi a munkákat">
        <p className="mb-2 text-sm text-[var(--muted)]">Ki végzi a munkákat ezen a projekten. A vállalókat a Tételek fül Részletes nézetében lehet kijelölni.</p>
        {csoportok.size === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Még nincs kijelölt vállaló.{" "}
            <button type="button" onClick={onMegnyit} className="text-[var(--primary)] underline">Tételek megnyitása</button>
          </p>
        )}
        <ul className="space-y-2">
          {[...csoportok.entries()].map(([n, c]) => (
            <li key={n} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  {c.id ? <Link href={`/alvallalkozok/${c.id}`} className="text-[var(--primary)] hover:underline">{n}</Link> : n}
                </h2>
                <span className="text-xs text-[var(--muted)]">{c.tetelek.length} tétel</span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{c.tetelek.join(", ")}</p>
            </li>
          ))}
        </ul>
        {gyartok.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-1 text-sm font-semibold">Gyártók és beszállítók</h2>
            <ul className="space-y-1 text-sm">
              {gyartok.map((t) => (
                <li key={t.id}><span className="font-medium">{t.munkanem.nev}</span> <span className="text-[var(--muted)]">{t.info}</span></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-label="Partnertörzs">
        <h2 className="mb-2 text-sm font-semibold">Partnertörzs (alvállalkozók, gyártók, kivitelezők)</h2>
        {hiba && <p role="alert" className="mb-2 text-sm text-[var(--danger)]">{hiba}</p>}
        <form onSubmit={felvesz} className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-[var(--muted)]">
            Partner neve
            <input value={nev} onChange={(e) => setNev(e.target.value)} className={mezo} />
          </label>
          <label className="flex flex-col text-xs text-[var(--muted)]">
            Kapcsolattartó, telefon
            <input value={kapcsolat} onChange={(e) => setKapcsolat(e.target.value)} className={mezo} />
          </label>
          <button type="submit" disabled={!nev.trim()} className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-white disabled:opacity-50">Partner felvétele</button>
        </form>
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          {partnerek.length === 0 && <li className="p-3 text-sm text-[var(--muted)]">Még nincs partner a törzsben.</li>}
          {partnerek.map((p) =>
            szerk?.id === p.id ? (
              <li key={p.id} className="flex flex-wrap items-end gap-2 p-2">
                <input aria-label="Partner neve" value={szerk.nev} onChange={(e) => setSzerk({ ...szerk, nev: e.target.value })} className={mezo} />
                <input aria-label="Kapcsolat" value={szerk.kapcsolat} onChange={(e) => setSzerk({ ...szerk, kapcsolat: e.target.value })} className={mezo} />
                <button type="button" onClick={ment} className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-white">Mentés</button>
                <button type="button" onClick={() => setSzerk(null)} className="px-2 py-1.5 text-sm text-[var(--muted)]">Mégse</button>
              </li>
            ) : (
              <li key={p.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                <span>
                  <Link href={`/alvallalkozok/${p.id}`} className="font-medium text-[var(--primary)] hover:underline">{p.nev}</Link>
                  {p.kapcsolat && <span className="ml-2 text-[var(--muted)]">{p.kapcsolat}</span>}
                </span>
                <button type="button" onClick={() => setSzerk({ id: p.id, nev: p.nev, kapcsolat: p.kapcsolat ?? "" })} className="text-xs text-[var(--primary)] underline">Szerkesztés</button>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
