"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, ProjektListItem, ProjektTipus, Ugyfel } from "@/lib/api";

const ALLAPOT_LABEL: Record<string, string> = {
  uj: "Új",
  ajanlat: "Ajánlat",
  szerzodott: "Szerződött",
  kivitelezes: "Kivitelezés",
  lezart: "Lezárt",
};

export default function ProjektekPage() {
  const [projektek, setProjektek] = useState<ProjektListItem[]>([]);
  const [ugyfelek, setUgyfelek] = useState<Ugyfel[]>([]);
  const [tipusok, setTipusok] = useState<ProjektTipus[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [projektNev, setProjektNev] = useState("");
  const [ugyfelId, setUgyfelId] = useState<string>("");
  const [epitesiCim, setEpitesiCim] = useState("");
  const [utemezesAktiv, setUtemezesAktiv] = useState(false);
  const [projektTipusId, setProjektTipusId] = useState<string>("");
  const [error, setError] = useState("");

  function load() {
    api.listProjektek().then(setProjektek).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api.listUgyfelek().then(setUgyfelek).catch(() => {});
    api.listProjektTipusok().then(setTipusok).catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createProjekt({
        projekt_nev: projektNev,
        utemezes_aktiv: utemezesAktiv,
        projekt_tipus_id: projektTipusId ? Number(projektTipusId) : null,
        ugyfelek: ugyfelId
          ? [{ ugyfel_id: Number(ugyfelId), epitesi_cim: epitesiCim || null }]
          : [],
      });
      setProjektNev("");
      setUgyfelId("");
      setEpitesiCim("");
      setUtemezesAktiv(false);
      setProjektTipusId("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projektek</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
        >
          <Plus size={16} /> Új projekt
        </button>
      </div>

      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 grid max-w-xl grid-cols-2 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <input
            placeholder="Projekt neve"
            required
            value={projektNev}
            onChange={(e) => setProjektNev(e.target.value)}
            className="col-span-2 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <select
            value={ugyfelId}
            onChange={(e) => setUgyfelId(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            <option value="">Ügyfél (opcionális)</option>
            {ugyfelek.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nev}
              </option>
            ))}
          </select>
          <input
            placeholder="Építési cím"
            value={epitesiCim}
            onChange={(e) => setEpitesiCim(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <select
            value={projektTipusId}
            onChange={(e) => setProjektTipusId(e.target.value)}
            className="col-span-2 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            <option value="">Épülettípus (opcionális fázis-sablon)</option>
            {tipusok.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nev}
              </option>
            ))}
          </select>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={utemezesAktiv} onChange={(e) => setUtemezesAktiv(e.target.checked)} />
            Ütemező bekapcsolása ennél a projektnél
          </label>
          <button
            type="submit"
            className="col-span-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Mentés
          </button>
        </form>
      )}

      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Projekt</th>
              <th className="px-3 py-2">Állapot</th>
              <th className="px-3 py-2">Ütemező</th>
            </tr>
          </thead>
          <tbody>
            {projektek.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <Link href={`/projektek/${p.id}`} className="text-[var(--primary)] hover:underline">
                    {p.projekt_nev}
                  </Link>
                </td>
                <td className="px-3 py-2">{ALLAPOT_LABEL[p.allapot] || p.allapot}</td>
                <td className="px-3 py-2">{p.utemezes_aktiv ? "Aktív" : "—"}</td>
              </tr>
            ))}
            {projektek.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nincs még projekt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
