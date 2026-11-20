"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Feladat, ProjektListItem, UserBrief, UserResponse, api } from "@/lib/api";

const inputCls = "rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";
const btnCls =
  "flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] disabled:opacity-60";
const cardCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]";

function isOverdue(hatarido: string | null | undefined, kesz: boolean): boolean {
  if (!hatarido || kesz) return false;
  return new Date(hatarido) < new Date(new Date().toDateString());
}

export default function FeladatokPage() {
  const [me, setMe] = useState<UserResponse | null>(null);
  const [feladatok, setFeladatok] = useState<Feladat[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [projektek, setProjektek] = useState<ProjektListItem[]>([]);
  const [csakEnyem, setCsakEnyem] = useState(true);
  const [mutatKeszeket, setMutatKeszeket] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [cim, setCim] = useState("");
  const [leiras, setLeiras] = useState("");
  const [hatarido, setHatarido] = useState("");
  const [felelosId, setFelelosId] = useState<number | "">("");
  const [projektId, setProjektId] = useState<number | "">("");

  function load() {
    api.listFeladatok().then(setFeladatok).catch(() => {});
  }

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.usersDirectory().then(setUsers).catch(() => {});
    api.listProjektek().then(setProjektek).catch(() => {});
    load();
  }, []);

  const lathato = useMemo(() => {
    return feladatok
      .filter((f) => (csakEnyem && me ? f.felelos_id === me.id : true))
      .filter((f) => (mutatKeszeket ? true : !f.kesz));
  }, [feladatok, csakEnyem, me, mutatKeszeket]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!cim) return;
    await api.createFeladat({
      cim,
      leiras: leiras || null,
      hatarido: hatarido || null,
      felelos_id: felelosId === "" ? null : felelosId,
      projekt_id: projektId === "" ? null : projektId,
    });
    setCim("");
    setLeiras("");
    setHatarido("");
    setFelelosId("");
    setProjektId("");
    setShowForm(false);
    load();
  }

  async function toggleKesz(f: Feladat) {
    await api.updateFeladat(f.id, { kesz: !f.kesz });
    load();
  }

  async function remove(f: Feladat) {
    if (!confirm(`Biztosan törlöd: ${f.cim}?`)) return;
    await api.deleteFeladat(f.id);
    load();
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">Feladatok</h1>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={csakEnyem} onChange={(e) => setCsakEnyem(e.target.checked)} />
          Csak az enyém
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={mutatKeszeket} onChange={(e) => setMutatKeszeket(e.target.checked)} />
          Kész feladatok is
        </label>
        <button onClick={() => setShowForm((s) => !s)} className={`${btnCls} ml-auto`}>
          <Plus size={14} /> Új feladat
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className={`${cardCls} mb-4 space-y-2 p-3`}>
          <input placeholder="Cím" value={cim} onChange={(e) => setCim(e.target.value)} className={`${inputCls} w-full`} required />
          <textarea
            placeholder="Leírás (opcionális)"
            value={leiras}
            onChange={(e) => setLeiras(e.target.value)}
            className={`${inputCls} w-full`}
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <input type="date" value={hatarido} onChange={(e) => setHatarido(e.target.value)} className={inputCls} />
            <select
              value={felelosId}
              onChange={(e) => setFelelosId(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputCls}
            >
              <option value="">Felelős...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
            <select
              value={projektId}
              onChange={(e) => setProjektId(e.target.value === "" ? "" : Number(e.target.value))}
              className={inputCls}
            >
              <option value="">Projekt nélkül</option>
              {projektek.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projekt_nev}
                </option>
              ))}
            </select>
            <button type="submit" className={btnCls}>
              Létrehozás
            </button>
          </div>
        </form>
      )}

      <ul className={`${cardCls} divide-y divide-[var(--border)]`}>
        {lathato.map((f) => (
          <li key={f.id} className="flex items-start gap-3 px-3 py-2 text-sm">
            <input type="checkbox" checked={f.kesz} onChange={() => toggleKesz(f)} className="mt-1" />
            <div className="flex-1">
              <div className={f.kesz ? "text-[var(--muted)] line-through" : ""}>{f.cim}</div>
              {f.leiras && <div className="text-xs text-[var(--muted)]">{f.leiras}</div>}
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                {f.hatarido && (
                  <span className={isOverdue(f.hatarido, f.kesz) ? "font-semibold text-[var(--danger)]" : ""}>
                    Határidő: {f.hatarido}
                  </span>
                )}
                {f.felelos && <span>Felelős: {f.felelos.full_name}</span>}
                {f.projekt_id && f.projekt_nev && (
                  <Link href={`/projektek/${f.projekt_id}`} className="text-[var(--primary)] hover:underline">
                    {f.projekt_nev}
                  </Link>
                )}
              </div>
            </div>
            <button onClick={() => remove(f)} className="text-[var(--danger)]">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {lathato.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Nincs megjelenítendő feladat.</li>
        )}
      </ul>
    </AppLayout>
  );
}
