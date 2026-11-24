"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Feladat, LejartSzamlaItem, ProjektTetel, api } from "@/lib/api";

const huf = (v: string | number) => `${Number(v).toLocaleString("hu-HU")} Ft`;
const ma = () => new Date().toISOString().slice(0, 10);

// A projekt Áttekintésének fő blokkja: ami most figyelmet kér (lejárt pénz, késő tétel, közelgő feladat, utolsó napló).
export default function MiKellMost({
  projektId,
  tetelek,
  onNavigate,
}: {
  projektId: number;
  tetelek: ProjektTetel[];
  onNavigate: (ful: "tetelek" | "feladatok") => void;
}) {
  const [szamlak, setSzamlak] = useState<LejartSzamlaItem[] | null>(null);
  const [feladatok, setFeladatok] = useState<Feladat[] | null>(null);

  useEffect(() => {
    api.getPenzugyiOsszesito().then((o) => setSzamlak(o.lejart_szamlak.filter((s) => s.projekt_id === projektId))).catch(() => setSzamlak([]));
    api.listFeladatok({ projekt_id: projektId, kesz: false }).then(setFeladatok).catch(() => setFeladatok([]));
  }, [projektId]);

  // Csak a ténylegesen folyamatban lévő, határidőn túli tétel késik; az ajánlati fázisú tétel még nem indult el.
  const keso = tetelek.filter((t) => t.end_date && t.end_date < ma() && t.szakasz === "kivitelezes");
  const kovetkezo = (feladatok ?? [])
    .slice()
    .sort((a, b) => (a.hatarido || "9999").localeCompare(b.hatarido || "9999"))
    .slice(0, 3);

  if (szamlak === null || feladatok === null) {
    return <div role="status" aria-label="Összegzés betöltése" className="h-32 animate-pulse rounded-[var(--radius)] bg-[var(--border)]" />;
  }
  const minden = szamlak.length === 0 && keso.length === 0;

  return (
    <section aria-labelledby="mikellmost" className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 id="mikellmost" className="mb-3 text-sm font-semibold">Mi kell most</h2>
      {minden && <p className="mb-3 text-sm text-[var(--positive)]">Nincs lejárt számla és nincs késő tétel ezen a projekten.</p>}
      {szamlak.length > 0 && (
        <div className="mb-3 rounded-[var(--radius)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] p-3">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--danger)]">
            <AlertTriangle size={15} aria-hidden="true" /> Lejárt számlák ({szamlak.length})
          </h3>
          <ul className="space-y-1 text-sm">
            {szamlak.map((s) => (
              <li key={`${s.forras_tipus}-${s.forras_id}`} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {s.szamlaszam} — {s.partner_nev}
                  <span className="block text-xs text-[var(--muted)]">
                    {s.forras_tipus === "ugyfel_szamla" ? "Bevétel" : "Kiadás"} · esedékes: {s.esedekesseg}
                  </span>
                </span>
                <span className="font-semibold tabular-nums text-[var(--danger)]">{huf(s.hatralek)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {keso.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 text-sm font-semibold text-[var(--danger)]">Késő tételek ({keso.length})</h3>
          <ul className="space-y-0.5 text-sm">
            {keso.slice(0, 4).map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>{t.munkanem.nev}</span>
                <span className="tabular-nums text-[var(--muted)]">határidő: {t.end_date}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onNavigate("tetelek")} className="mt-1 min-h-9 text-xs text-[var(--primary)] hover:underline">
            Mind a Tételek fülön{keso.length > 4 ? ` (+${keso.length - 4})` : ""}
          </button>
        </div>
      )}
      <div className="mb-3">
        <h3 className="mb-1 text-sm font-semibold">Következő feladatok</h3>
        {kovetkezo.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nincs nyitott feladat.</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {kovetkezo.map((f) => (
              <li key={f.id} className="flex justify-between gap-3">
                <span>{f.cim}</span>
                {f.hatarido && (
                  <span className={`tabular-nums ${f.hatarido < ma() ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}>{f.hatarido}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => onNavigate("feladatok")} className="mt-1 min-h-9 text-xs text-[var(--primary)] hover:underline">
          Összes feladat
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Teljes pénzügyi kép: <Link href="/penzugy" className="text-[var(--primary)] hover:underline">Pénzügy</Link>
      </p>
    </section>
  );
}
