"use client";

import { useEffect, useState } from "react";
import { api, ProjektTipus, SablonTetel } from "@/lib/api";

/** Törzsadat › Ütemezés: a projekttípusok tételeinek alapértelmezett átfutási és előkészítési ideje. Az új projektek ebből indulnak. */
export default function TorzsadatUtemezes() {
  const [tipusok, setTipusok] = useState<ProjektTipus[]>([]);
  const [tipusId, setTipusId] = useState<number | null>(null);
  const [sorok, setSorok] = useState<SablonTetel[] | null>(null);
  const [hiba, setHiba] = useState("");
  const [mentve, setMentve] = useState("");

  useEffect(() => {
    api.listProjektTipusok().then((t) => {
      setTipusok(t);
      if (t.length) setTipusId(t[0].id);
    }).catch((e) => setHiba(e.message));
  }, []);
  useEffect(() => {
    if (tipusId == null) return;
    setSorok(null);
    api.listTetelSablonok(tipusId).then(setSorok).catch((e) => setHiba(e.message));
  }, [tipusId]);

  async function ment(s: SablonTetel, mezo: "duration_days" | "prep_days", ertek: string) {
    const n = Number(ertek);
    if (!Number.isFinite(n) || ertek === "" || n === s[mezo]) return;
    setHiba("");
    try {
      const uj = await api.updateTetelSablon(s.id, { [mezo]: n });
      setSorok((l) => (l ?? []).map((x) => (x.id === uj.id ? uj : x)));
      setMentve(`${s.munkanem_nev}: mentve`);
    } catch (e) {
      setHiba(e instanceof Error ? e.message : "Hiba a mentéskor");
    }
  }

  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Egy új projekt tételei ezekből az alapidőkből indulnak, a projekten belül utána szabadon módosíthatók. A már létező projekteket a változtatás nem érinti.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Projekttípus</span>
        <select value={tipusId ?? ""} onChange={(e) => setTipusId(Number(e.target.value))} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2">
          {tipusok.map((t) => <option key={t.id} value={t.id}>{t.nev}</option>)}
        </select>
      </label>
      {hiba && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{hiba}</div>}
      <div role="status" className="min-h-5 text-sm text-[var(--positive)]">{mentve}</div>
      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Munkanem</th>
              <th className="px-3 py-2 font-medium">Átfutás (nap)</th>
              <th className="px-3 py-2 font-medium">Előkészítés (nap)</th>
            </tr>
          </thead>
          <tbody>
            {(sorok ?? []).map((s) => (
              <tr key={s.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5">{s.munkanem_nev}</td>
                {(["duration_days", "prep_days"] as const).map((m) => (
                  <td key={m} className="px-3 py-1.5">
                    <input
                      type="number"
                      min={m === "duration_days" ? 1 : 0}
                      defaultValue={s[m]}
                      key={`${s.id}-${m}-${s[m]}`}
                      aria-label={`${s.munkanem_nev}, ${m === "duration_days" ? "átfutás" : "előkészítés"} napokban`}
                      onBlur={(e) => ment(s, m, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-20 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1"
                    />
                  </td>
                ))}
              </tr>
            ))}
            {sorok && sorok.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-[var(--muted)]">Ennek a típusnak még nincs tétel-sablonja.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
