"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Feladat, UserBrief, api } from "@/lib/api";

const inputCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm";
const btnCls =
  "flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] disabled:opacity-60";

function lejart(hatarido: string | null | undefined, kesz: boolean) {
  if (!hatarido || kesz) return false;
  return new Date(hatarido) < new Date(new Date().toDateString());
}

// A projekt saját feladatai: létrehozás, kiosztás felelősnek, határidő, késznek jelölés.
export default function FeladatokTab({ projektId }: { projektId: number }) {
  const [feladatok, setFeladatok] = useState<Feladat[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [mutatKeszeket, setMutatKeszeket] = useState(true);
  const [cim, setCim] = useState("");
  const [leiras, setLeiras] = useState("");
  const [hatarido, setHatarido] = useState("");
  const [felelosId, setFelelosId] = useState<number | "">("");
  const [error, setError] = useState("");

  function load() {
    api.listFeladatok({ projekt_id: projektId }).then(setFeladatok).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api.usersDirectory().then(setUsers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projektId]);

  const lathato = useMemo(
    () => feladatok.filter((f) => mutatKeszeket || !f.kesz).sort((a, b) => Number(a.kesz) - Number(b.kesz) || (a.hatarido ?? "9999").localeCompare(b.hatarido ?? "9999")),
    [feladatok, mutatKeszeket]
  );
  const nyitott = feladatok.filter((f) => !f.kesz).length;

  async function letrehoz(e: FormEvent) {
    e.preventDefault();
    if (!cim.trim()) return;
    try {
      await api.createFeladat({
        cim: cim.trim(),
        leiras: leiras || null,
        hatarido: hatarido || null,
        felelos_id: felelosId === "" ? null : felelosId,
        projekt_id: projektId,
      });
      setCim("");
      setLeiras("");
      setHatarido("");
      setFelelosId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba a mentéskor");
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {error && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      <form onSubmit={letrehoz} className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3" aria-label="Új feladat">
        <input placeholder="Új feladat címe" aria-label="Feladat címe" value={cim} onChange={(e) => setCim(e.target.value)} className={`${inputCls} w-full`} required />
        <textarea placeholder="Leírás (opcionális)" aria-label="Leírás" value={leiras} onChange={(e) => setLeiras(e.target.value)} className={`${inputCls} w-full`} rows={2} />
        <div className="flex flex-wrap gap-2">
          <input type="date" aria-label="Határidő" value={hatarido} onChange={(e) => setHatarido(e.target.value)} className={inputCls} />
          <select aria-label="Felelős" value={felelosId} onChange={(e) => setFelelosId(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls}>
            <option value="">Felelős...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
          <button type="submit" className={btnCls}>
            <Plus size={14} /> Feladat hozzáadása
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">{nyitott} nyitott feladat</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mutatKeszeket} onChange={(e) => setMutatKeszeket(e.target.checked)} />
          Kész feladatok is
        </label>
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" data-testid="projekt-feladatok">
        {lathato.map((f) => (
          <li key={f.id} className="flex items-start gap-3 px-3 py-2 text-sm">
            <input
              type="checkbox"
              aria-label={`${f.cim} kész`}
              checked={f.kesz}
              onChange={async () => {
                await api.updateFeladat(f.id, { kesz: !f.kesz });
                load();
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <div className={f.kesz ? "text-[var(--muted)] line-through" : ""}>{f.cim}</div>
              {f.leiras && <div className="text-xs text-[var(--muted)]">{f.leiras}</div>}
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                {f.hatarido && <span className={lejart(f.hatarido, f.kesz) ? "font-semibold text-[var(--danger)]" : ""}>Határidő: {f.hatarido}</span>}
                {f.felelos && <span>Felelős: {f.felelos.full_name}</span>}
              </div>
            </div>
            <button
              aria-label={`${f.cim} törlése`}
              onClick={async () => {
                if (!confirm(`Biztosan törlöd: ${f.cim}?`)) return;
                await api.deleteFeladat(f.id);
                load();
              }}
              className="text-[var(--danger)]"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {lathato.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Ehhez a projekthez még nincs feladat.</li>}
      </ul>
    </div>
  );
}
