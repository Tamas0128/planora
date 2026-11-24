"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, CashflowItem } from "@/lib/api";

const ft = (v: string | number) => `${Math.round(Number(v)).toLocaleString("hu-HU")} Ft`;
const RETEG: Record<string, string> = { teny: "Számlázott", terv: "Tervezett" };

/** A projekt bevételei vagy kiadásai egy listában, a teljes cash flow egy kattintásra. */
export default function ProjektPenz({ projektId, irany }: { projektId: number; irany: "bevetel" | "kiadas" }) {
  const [lista, setLista] = useState<CashflowItem[] | null>(null);
  const [hiba, setHiba] = useState("");

  useEffect(() => {
    setLista(null);
    api.listProjektPenzmozgasok(projektId, irany).then(setLista).catch((e) => setHiba(e.message));
  }, [projektId, irany]);

  const cim = irany === "bevetel" ? "Bevétel" : "Kiadás";
  const osszeg = (reteg: string) => (lista ?? []).filter((i) => i.reteg === reteg).reduce((s, i) => s + Number(i.osszeg), 0);

  return (
    <div className="max-w-3xl space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {["teny", "terv"].map((r) => (
          <div key={r} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="text-xs text-[var(--muted)]">{cim}, {RETEG[r].toLowerCase()}</div>
            <div className="font-heading text-lg font-semibold tabular-nums">{ft(osszeg(r))}</div>
          </div>
        ))}
      </div>
      {hiba && <p role="alert" className="text-sm text-[var(--danger)]">{hiba}</p>}
      {lista === null && !hiba && <div role="status" aria-label="Betöltés" className="h-20 animate-pulse rounded-[var(--radius)] bg-[var(--border)]" />}
      {lista && lista.length === 0 && <p className="text-sm text-[var(--muted)]">Ehhez a projekthez még nincs {cim.toLowerCase()}. A számlák a Pénzügy menüben rögzíthetők.</p>}
      {lista && lista.length > 0 && (
        <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Esedékes</th>
                <th className="px-3 py-2 font-medium">Tétel</th>
                <th className="px-3 py-2 font-medium">Állapot</th>
                <th className="px-3 py-2 text-right font-medium">Összeg</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i, n) => (
                <tr key={`${i.forras_tipus}-${i.forras_id}-${n}`} className="border-t border-[var(--border)]">
                  <td className={`px-3 py-1.5 tabular-nums ${i.lejart ? "font-semibold text-[var(--danger)]" : ""}`}>{i.esedekesseg}</td>
                  <td className="px-3 py-1.5">{i.leiras}</td>
                  <td className="px-3 py-1.5 text-[var(--muted)]">{i.lejart ? "Lejárt" : RETEG[i.reteg] ?? i.reteg}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{ft(i.osszeg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm">
        <Link href={`/penzugy?projekt=${projektId}`} className="text-[var(--primary)] hover:underline">Teljes cash flow erre a projektre</Link>
      </p>
    </div>
  );
}
