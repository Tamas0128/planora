"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import Morzsa from "@/components/Morzsa";
import Skeleton from "@/components/Skeleton";
import { api, UtemProjekt } from "@/lib/api";

const NAP = 86400000;
const nap = (d: string) => new Date(d).getTime() / NAP;
const HONAP = ["jan", "feb", "már", "ápr", "máj", "jún", "júl", "aug", "szep", "okt", "nov", "dec"];

export default function UtemtervPage() {
  const [lista, setLista] = useState<UtemProjekt[] | null>(null);
  const [hiba, setHiba] = useState("");
  const [csakKesok, setCsakKesok] = useState(false);
  const [nyitott, setNyitott] = useState<number | null>(null);

  useEffect(() => {
    api.getUtemterv().then(setLista).catch((e) => setHiba(e.message));
  }, []);

  const lathato = useMemo(() => (lista ?? []).filter((p) => !csakKesok || p.keso), [lista, csakKesok]);
  const { min, max } = useMemo(() => {
    const k = lathato.map((p) => nap(p.kezdes as string));
    const v = lathato.map((p) => nap(p.vege as string));
    return { min: k.length ? Math.min(...k) : 0, max: v.length ? Math.max(...v) : 1 };
  }, [lathato]);
  const hossz = Math.max(max - min, 1);
  const pct = (d: string) => ((nap(d) - min) / hossz) * 100;
  const ma = Date.now() / NAP;

  const honapok: { cimke: string; left: number }[] = [];
  if (lathato.length) {
    const c = new Date(min * NAP);
    c.setUTCDate(1);
    c.setUTCMonth(c.getUTCMonth() + 1);
    while (c.getTime() / NAP <= max) {
      honapok.push({ cimke: HONAP[c.getUTCMonth()] + (c.getUTCMonth() === 0 ? ` ${c.getUTCFullYear()}` : ""), left: ((c.getTime() / NAP - min) / hossz) * 100 });
      c.setUTCMonth(c.getUTCMonth() + 1);
    }
  }

  return (
    <AppLayout>
      <Morzsa elemek={[{ cimke: "Projektek", href: "/projektek" }, { cimke: "Ütemterv" }]} />
      <h1 className="mb-1 text-xl font-semibold">Ütemterv</h1>
      <p className="mb-3 max-w-2xl text-sm text-[var(--muted)]">Az ütemezett projektek egy időtengelyen. A piros sáv azt jelzi, hogy a projektnek van határidőn túli, nem kész tétele. Egy projektre kattintva a tételei is látszanak.</p>
      <div role="group" aria-label="Szűrés" className="mb-3 flex gap-1 text-sm">
        {([[false, "Minden ütemezett"], [true, "Csak a késők"]] as const).map(([v, l]) => (
          <button key={l} type="button" aria-pressed={csakKesok === v} onClick={() => setCsakKesok(v)} className={`min-h-9 rounded-full px-3 ${csakKesok === v ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] text-[var(--muted)]"}`}>{l}</button>
        ))}
      </div>
      {hiba && <p role="alert" className="text-[var(--danger)]">{hiba}</p>}
      {!lista && !hiba && <Skeleton cimke="Ütemterv betöltése" />}
      {lista && lathato.length === 0 && <p className="text-sm text-[var(--muted)]">{csakKesok ? "Nincs késő projekt." : "Még egy projektnél sincs ütemezés. Az ütemező a projekt Ütemezés fülén kapcsolható be."}</p>}
      {lathato.length > 0 && (
        <div tabIndex={0} role="group" aria-label="Ütemterv Gantt-diagram" className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="min-w-[720px]">
            <div className="mb-1 flex items-end gap-2 text-xs text-[var(--muted)]">
              <div className="w-44 shrink-0">Projekt</div>
              <div className="relative h-5 flex-1">
                {honapok.map((h) => <span key={h.left} className="absolute bottom-0 border-l border-[var(--border)] pl-1 leading-5" style={{ left: `${h.left}%` }}>{h.cimke}</span>)}
              </div>
            </div>
            <div className="space-y-1">
              {lathato.map((p) => (
                <div key={p.projekt_id}>
                  <div className="flex items-center gap-2 text-xs">
                    <button type="button" onClick={() => setNyitott(nyitott === p.projekt_id ? null : p.projekt_id)} aria-expanded={nyitott === p.projekt_id} className="w-44 shrink-0 truncate text-left font-medium hover:underline" title={p.projekt_nev}>{p.projekt_nev}</button>
                    <div className="relative h-6 flex-1 rounded bg-[var(--muted-bg)]">
                      {ma >= min && ma <= max && <span aria-hidden="true" className="absolute inset-y-0 z-10 border-l-2 border-[var(--foreground)]" style={{ left: `${((ma - min) / hossz) * 100}%` }} />}
                      <div role="img" aria-label={`${p.projekt_nev}: ${p.kezdes} – ${p.vege}${p.keso ? ", késik" : ""}`} className="absolute top-1 h-4 rounded" style={{ left: `${pct(p.kezdes as string)}%`, width: `${Math.max(pct(p.vege as string) - pct(p.kezdes as string), 1.2)}%`, backgroundColor: p.keso ? "var(--danger)" : "var(--primary)" }} />
                    </div>
                  </div>
                  {nyitott === p.projekt_id && (
                    <div className="mb-2 mt-1 space-y-1 border-l-2 border-[var(--border)] pl-2">
                      {p.szakaszok.map((s) => (
                        <div key={s.tetel_id} className="flex items-center gap-2 text-xs">
                          <div className="w-44 shrink-0 truncate pl-2 text-[var(--muted)]" title={s.nev}>{s.nev}</div>
                          <div className="relative h-4 flex-1 rounded bg-[var(--muted-bg)]">
                            <div className="absolute top-0.5 h-3 rounded" title={`${s.kezdes} – ${s.vege}`} style={{ left: `${pct(s.kezdes)}%`, width: `${Math.max(pct(s.vege) - pct(s.kezdes), 1)}%`, backgroundColor: s.szakasz === "kesz" ? "var(--color-accent-400)" : nap(s.vege) < ma ? "var(--danger)" : "var(--primary)" }} />
                          </div>
                        </div>
                      ))}
                      <Link href={`/projektek/${p.projekt_id}`} className="inline-block pl-2 text-xs text-[var(--primary)] hover:underline">Projekt megnyitása</Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
