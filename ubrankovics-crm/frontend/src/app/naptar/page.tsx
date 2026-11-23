"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, NaptarEsemeny } from "@/lib/api";

const HONAPOK = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const NAPOK = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

const TIPUS_LABEL: Record<NaptarEsemeny["tipus"], string> = {
  feladat: "Feladat",
  atadas: "Átadás",
  tetel: "Ütemezett tétel",
  garancia: "Garancia lejár",
};
// A típust a címke szövege és a jelölő forma is hordozza, nem csak a szín.
const TIPUS_STIL: Record<NaptarEsemeny["tipus"], string> = {
  feladat: "border-[var(--border)] bg-[var(--card)]",
  atadas: "border-[var(--primary)] bg-[var(--card)] font-medium",
  tetel: "border-transparent bg-black/5",
  garancia: "border-dashed border-[var(--critical)] bg-[var(--card)]",
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function NaptarPage() {
  const [ev, setEv] = useState(() => {
    const m = new Date();
    return new Date(m.getFullYear(), m.getMonth(), 1);
  });
  const [esemenyek, setEsemenyek] = useState<NaptarEsemeny[]>([]);
  const [error, setError] = useState("");
  const [kivalasztott, setKivalasztott] = useState<string | null>(null);

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
    api.getNaptar(tol, ig).then((r) => {
      setEsemenyek(r);
      setError("");
    }).catch((e) => setError(e.message));
  }, [tol, ig]);

  const napiEsemenyek = (nap: string) => esemenyek.filter((e) => e.kezdes <= nap && e.vege >= nap);
  const ma = iso(new Date());
  const lista = kivalasztott ? napiEsemenyek(kivalasztott) : esemenyek.filter((e) => e.vege >= iso(new Date(ev.getFullYear(), ev.getMonth(), 1)) && e.kezdes <= iso(new Date(ev.getFullYear(), ev.getMonth() + 1, 0)));

  function lepes(d: number) {
    setEv(new Date(ev.getFullYear(), ev.getMonth() + d, 1));
    setKivalasztott(null);
  }

  return (
    <AppLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <CalendarDays size={20} /> Naptár
        </h1>
        <button
          onClick={() => api.downloadNaptarIcs().catch((e) => setError(e.message))}
          className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          <Download size={14} /> iCal exportálás (.ics)
        </button>
      </div>
      {error && <div role="alert" className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      <div className="mb-3 flex items-center gap-2">
        <button aria-label="Előző hónap" onClick={() => lepes(-1)} className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)]">
          <ChevronLeft size={16} />
        </button>
        <h2 className="min-w-40 text-center text-base font-semibold" aria-live="polite">
          {ev.getFullYear()}. {HONAPOK[ev.getMonth()]}
        </h2>
        <button aria-label="Következő hónap" onClick={() => lepes(1)} className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)]">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => { const m = new Date(); setEv(new Date(m.getFullYear(), m.getMonth(), 1)); setKivalasztott(iso(m)); }} className="ml-2 rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--primary)]">
          Ma
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)]" role="grid" aria-label="Hónap naptár">
        {NAPOK.map((n) => (
          <div key={n} role="columnheader" className="bg-[var(--card)] py-1 text-center text-xs font-medium text-[var(--muted)]">
            {n}
          </div>
        ))}
        {napok.map((d) => {
          const k = iso(d);
          const ebben = d.getMonth() === ev.getMonth();
          const napi = napiEsemenyek(k);
          return (
            <button
              key={k}
              role="gridcell"
              aria-label={`${k}, ${napi.length} esemény`}
              aria-selected={kivalasztott === k}
              onClick={() => setKivalasztott(kivalasztott === k ? null : k)}
              className={`min-h-14 p-1 text-left align-top md:min-h-24 ${ebben ? "bg-[var(--card)]" : "bg-[var(--background)] text-[var(--muted)]"} ${kivalasztott === k ? "outline outline-2 -outline-offset-2 outline-[var(--primary)]" : ""}`}
            >
              <span className={`text-xs ${k === ma ? "rounded-full bg-[var(--primary)] px-1.5 py-0.5 font-semibold text-[var(--primary-foreground)]" : ""}`}>{d.getDate()}</span>
              <span className="mt-1 block space-y-0.5 max-md:hidden">
                {napi.slice(0, 3).map((e) => (
                  <span key={e.kulcs} className={`block truncate rounded border px-1 text-xs ${TIPUS_STIL[e.tipus]} ${e.kesz ? "line-through opacity-70" : ""}`}>
                    {e.cim}
                  </span>
                ))}
                {napi.length > 3 && <span className="block text-xs text-[var(--muted)]">+{napi.length - 3} további</span>}
              </span>
              {napi.length > 0 && <span className="mt-1 block text-xs font-medium md:hidden">{napi.length}</span>}
            </button>
          );
        })}
      </div>

      <section className="mt-4" aria-label="Események listája">
        <h2 className="mb-2 text-sm font-semibold">{kivalasztott ? `${kivalasztott} eseményei` : "A hónap eseményei"}</h2>
        {lista.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nincs esemény.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" data-testid="naptar-lista">
            {lista.map((e) => (
              <li key={e.kulcs} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className={e.kesz ? "line-through opacity-70" : ""}>
                  {e.projekt_id ? (
                    <Link href={`/projektek/${e.projekt_id}`} className="text-[var(--primary)] hover:underline">{e.cim}</Link>
                  ) : (
                    e.cim
                  )}
                </span>
                <span className="text-[var(--muted)]">
                  {TIPUS_LABEL[e.tipus]} · {e.kezdes === e.vege ? e.kezdes : `${e.kezdes} – ${e.vege}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  );
}
