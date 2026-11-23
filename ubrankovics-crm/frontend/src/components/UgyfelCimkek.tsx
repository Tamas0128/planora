"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, Cimke } from "@/lib/api";

/** Az ügyfél címkéi (szegmensek): hozzáadás meglévőből vagy új címke létrehozásával. */
export default function UgyfelCimkek({ ugyfelId }: { ugyfelId: number }) {
  const [sajat, setSajat] = useState<Cimke[]>([]);
  const [osszes, setOsszes] = useState<Cimke[]>([]);
  const [uj, setUj] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.getUgyfelCimkek(ugyfelId).then(setSajat).catch((e) => setError(e.message));
    api.listCimkek().then(setOsszes).catch(() => {});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ugyfelId]);

  async function beallit(ids: number[]) {
    setError("");
    try {
      setSajat(await api.setUgyfelCimkek(ugyfelId, ids));
      api.listCimkek().then(setOsszes).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function ujCimke(e: FormEvent) {
    e.preventDefault();
    if (!uj.trim()) return;
    setError("");
    try {
      const c = await api.createCimke(uj.trim());
      setUj("");
      await beallit([...sajat.map((x) => x.id), c.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  const hozzaadhato = osszes.filter((c) => !sajat.some((s) => s.id === c.id));

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Címkék</h2>
      {error && <div className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      <div className="flex flex-wrap gap-1">
        {sajat.length === 0 && <span className="text-sm text-[var(--muted)]">Nincs címke.</span>}
        {sajat.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs">
            {c.nev}
            <button className="-m-1 p-1" onClick={() => beallit(sajat.filter((x) => x.id !== c.id).map((x) => x.id))} aria-label={`${c.nev} címke eltávolítása`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {hozzaadhato.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && beallit([...sajat.map((x) => x.id), Number(e.target.value)])}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
            aria-label="Címke hozzáadása"
          >
            <option value="">+ címke…</option>
            {hozzaadhato.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nev}
              </option>
            ))}
          </select>
        )}
        <form onSubmit={ujCimke} className="flex gap-1">
          <input
            placeholder="Új címke"
            value={uj}
            onChange={(e) => setUj(e.target.value)}
            className="w-32 min-w-0 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <button type="submit" className="whitespace-nowrap rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm">
            Létrehoz
          </button>
        </form>
      </div>
    </div>
  );
}
