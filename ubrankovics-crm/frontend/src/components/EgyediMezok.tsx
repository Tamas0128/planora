"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api, EgyediMezoErtek } from "@/lib/api";

const TIPUS_INPUT: Record<string, string> = { szoveg: "text", szam: "text", datum: "date" };

/** Egyedi mezők kitöltése egy ügyfélhez / érdeklődőhöz. Az admin itt tud új mezőt felvenni is. */
export default function EgyediMezok({
  entitas,
  entitasId,
  isAdmin,
}: {
  entitas: "ugyfel" | "erdeklodes";
  entitasId: number;
  isAdmin: boolean;
}) {
  const [mezok, setMezok] = useState<EgyediMezoErtek[]>([]);
  const [ertekek, setErtekek] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [ujNev, setUjNev] = useState("");
  const [ujTipus, setUjTipus] = useState("szoveg");

  function load() {
    api
      .getEgyediMezoErtekek(entitas, entitasId)
      .then((r) => {
        setMezok(r);
        setErtekek(Object.fromEntries(r.map((m) => [m.mezo_id, m.ertek ?? ""])));
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitas, entitasId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      await api.putEgyediMezoErtekek(entitas, entitasId, ertekek);
      setSaved(true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function ujMezo(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createEgyediMezo({ entitas, nev: ujNev, tipus: ujTipus });
      setUjNev("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function mezoTorles(id: number, nev: string) {
    if (!confirm(`A(z) "${nev}" mező és minden kitöltött értéke törlődik. Biztos?`)) return;
    await api.deleteEgyediMezo(id);
    load();
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Egyedi mezők</h2>
      {error && <div className="mb-2 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      {mezok.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nincs egyedi mező definiálva{isAdmin ? "" : " (az admin vehet fel újat)"}.</p>
      ) : (
        <form onSubmit={save} className="space-y-2">
          {mezok.map((m) => (
            <div key={m.mezo_id} className="flex items-center gap-2">
              <label className="w-40 shrink-0 text-sm">{m.nev}</label>
              <input
                type={TIPUS_INPUT[m.tipus] || "text"}
                inputMode={m.tipus === "szam" ? "decimal" : undefined}
                value={ertekek[m.mezo_id] ?? ""}
                onChange={(e) => setErtekek({ ...ertekek, [m.mezo_id]: e.target.value })}
                className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              />
              {isAdmin && (
                <button type="button" onClick={() => mezoTorles(m.mezo_id, m.nev)} className="text-[var(--muted)] hover:text-[var(--danger)]" aria-label={`${m.nev} mező törlése`}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
            Mentés
          </button>
          {saved && <span className="ml-2 text-sm text-[var(--muted)]">Mentve.</span>}
        </form>
      )}
      {isAdmin && (
        <form onSubmit={ujMezo} className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
          <input
            required
            placeholder="Új mező neve"
            value={ujNev}
            onChange={(e) => setUjNev(e.target.value)}
            className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <select value={ujTipus} onChange={(e) => setUjTipus(e.target.value)} className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm" aria-label="Mező típusa">
            <option value="szoveg">Szöveg</option>
            <option value="szam">Szám</option>
            <option value="datum">Dátum</option>
          </select>
          <button type="submit" className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
            Mező felvétele
          </button>
        </form>
      )}
    </div>
  );
}
