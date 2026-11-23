"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, Jegy, JegyAllapot, JegyPrioritas, Ugyfel, UserBrief } from "@/lib/api";

const ALLAPOT: Record<JegyAllapot, string> = {
  nyitott: "Nyitott",
  folyamatban: "Folyamatban",
  megoldva: "Megoldva",
  lezart: "Lezárt",
};
const PRIORITAS: Record<JegyPrioritas, string> = { alacsony: "Alacsony", normal: "Normál", surgos: "Sürgős" };

const inputCls = "rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";

export default function JegyekPage() {
  const [jegyek, setJegyek] = useState<Jegy[]>([]);
  const [ugyfelek, setUgyfelek] = useState<Ugyfel[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [csakNyitott, setCsakNyitott] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [ugyfelId, setUgyfelId] = useState("");
  const [targy, setTargy] = useState("");
  const [leiras, setLeiras] = useState("");
  const [prioritas, setPrioritas] = useState<JegyPrioritas>("normal");
  const [felelosId, setFelelosId] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.listJegyek({ nyitott: csakNyitott }).then(setJegyek).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csakNyitott]);

  useEffect(() => {
    api.listUgyfelek().then(setUgyfelek).catch(() => {});
    api.usersDirectory().then(setUsers).catch(() => {});
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createJegy({
        ugyfel_id: Number(ugyfelId),
        targy,
        leiras: leiras || null,
        prioritas,
        felelos_id: felelosId ? Number(felelosId) : null,
      });
      setTargy("");
      setLeiras("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function frissit(j: Jegy, adat: Parameters<typeof api.updateJegy>[1]) {
    setError("");
    try {
      await api.updateJegy(j.id, adat);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function torol(j: Jegy) {
    if (!confirm(`Törlöd a jegyet: ${j.targy}?`)) return;
    await api.deleteJegy(j.id);
    load();
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ügyfélszolgálati jegyek</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={csakNyitott} onChange={(e) => setCsakNyitott(e.target.checked)} /> Csak nyitottak
          </label>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <Plus size={16} /> Új jegy
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="mb-4 grid max-w-2xl grid-cols-2 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <select required value={ugyfelId} onChange={(e) => setUgyfelId(e.target.value)} className={`col-span-2 ${inputCls}`} aria-label="Ügyfél">
            <option value="">Ügyfél kiválasztása…</option>
            {ugyfelek.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nev}
              </option>
            ))}
          </select>
          <input required placeholder="Tárgy" value={targy} onChange={(e) => setTargy(e.target.value)} className={`col-span-2 ${inputCls}`} />
          <textarea placeholder="Leírás" value={leiras} onChange={(e) => setLeiras(e.target.value)} className={`col-span-2 ${inputCls}`} rows={3} />
          <select value={prioritas} onChange={(e) => setPrioritas(e.target.value as JegyPrioritas)} className={inputCls} aria-label="Prioritás">
            {Object.entries(PRIORITAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={felelosId} onChange={(e) => setFelelosId(e.target.value)} className={inputCls} aria-label="Felelős">
            <option value="">Felelős nélkül</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <button type="submit" className="col-span-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
            Jegy rögzítése
          </button>
        </form>
      )}

      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Tárgy</th>
              <th className="px-3 py-2">Ügyfél</th>
              <th className="px-3 py-2">Prioritás</th>
              <th className="px-3 py-2">Felelős</th>
              <th className="px-3 py-2">Állapot</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {jegyek.map((j) => (
              <tr key={j.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <div className="font-medium">{j.targy}</div>
                  {j.leiras && <div className="text-xs text-[var(--muted)]">{j.leiras}</div>}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/ugyfelek/${j.ugyfel_id}`} className="text-[var(--primary)] hover:underline">
                    {j.ugyfel_nev}
                  </Link>
                </td>
                <td className={`px-3 py-2 ${j.prioritas === "surgos" ? "font-medium text-[var(--danger)]" : ""}`}>{PRIORITAS[j.prioritas]}</td>
                <td className="px-3 py-2">{j.felelos?.full_name || "—"}</td>
                <td className="px-3 py-2">
                  <select
                    value={j.allapot}
                    onChange={(e) => frissit(j, { allapot: e.target.value as JegyAllapot })}
                    className="rounded-[var(--radius)] border border-[var(--border)] px-1 py-0.5 text-xs"
                    aria-label={`${j.targy} állapota`}
                  >
                    {Object.entries(ALLAPOT).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => torol(j)} className="text-xs text-[var(--danger)]">
                    Törlés
                  </button>
                </td>
              </tr>
            ))}
            {jegyek.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nincs jegy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
