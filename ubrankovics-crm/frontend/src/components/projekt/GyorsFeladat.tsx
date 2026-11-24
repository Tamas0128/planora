"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { api, UserBrief } from "@/lib/api";

const inputCls = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-base md:text-sm";

/** Gyors feladatrögzítés a projekten belül, a helyszínről is: lebegő gomb (telefonon a hüvelykujj mellett), egy kérdéses űrlappal. */
export default function GyorsFeladat({ projektId, onCreated }: { projektId: number; onCreated: () => void }) {
  const [nyitva, setNyitva] = useState(false);
  const [cim, setCim] = useState("");
  const [hatarido, setHatarido] = useState("");
  const [felelosId, setFelelosId] = useState<string>("");
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState("");
  const [kesz, setKesz] = useState("");

  useEffect(() => {
    if (!nyitva) return;
    api.usersDirectory().then(setUsers).catch(() => {});
  }, [nyitva]);

  async function mentes(e: FormEvent) {
    e.preventDefault();
    if (!cim.trim()) return;
    setError("");
    try {
      await api.createFeladat({
        cim: cim.trim(),
        hatarido: hatarido || null,
        felelos_id: felelosId ? Number(felelosId) : null,
        projekt_id: projektId,
      });
      setCim("");
      setHatarido("");
      setFelelosId("");
      setNyitva(false);
      setKesz("Feladat rögzítve.");
      setTimeout(() => setKesz(""), 4000);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba a mentéskor");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setNyitva(true)}
        className="fixed bottom-4 right-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-foreground)] shadow-lg hover:bg-[var(--primary-hover)] md:bottom-6 md:right-6"
      >
        <Plus size={18} aria-hidden="true" /> Új feladat
      </button>
      {kesz && (
        <div role="status" className="fixed bottom-20 right-4 z-40 rounded-[var(--radius)] bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)] md:right-6">
          {kesz}
        </div>
      )}
      {nyitva && (
        <Modal title="Új feladat ehhez a projekthez" onClose={() => setNyitva(false)}>
          <form onSubmit={mentes} className="space-y-3">
            {error && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Mit kell megcsinálni?</span>
              <input autoFocus required value={cim} onChange={(e) => setCim(e.target.value)} placeholder="pl. Szigetelés pótlása a nyugati falon" className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Határidő</span>
                <input type="date" value={hatarido} onChange={(e) => setHatarido(e.target.value)} className={inputCls} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Felelős</span>
                <select value={felelosId} onChange={(e) => setFelelosId(e.target.value)} className={inputCls}>
                  <option value="">Nincs kijelölve</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="min-h-11 w-full rounded-[var(--radius)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)]">
              Feladat rögzítése
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
