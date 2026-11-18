"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, Ugyfel } from "@/lib/api";

export default function UgyfelekPage() {
  const [ugyfelek, setUgyfelek] = useState<Ugyfel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nev, setNev] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.listUgyfelek().then(setUgyfelek).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createUgyfel({ nev, telefon: telefon || null, email: email || null });
      setNev("");
      setTelefon("");
      setEmail("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ügyfelek</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
        >
          <Plus size={16} /> Új ügyfél
        </button>
      </div>

      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 grid max-w-xl grid-cols-3 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <input
            placeholder="Név"
            required
            value={nev}
            onChange={(e) => setNev(e.target.value)}
            className="col-span-3 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Telefon"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <input
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="col-span-2 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="col-span-3 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Mentés
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Név</th>
              <th className="px-3 py-2">Telefon</th>
              <th className="px-3 py-2">E-mail</th>
            </tr>
          </thead>
          <tbody>
            {ugyfelek.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <Link href={`/ugyfelek/${u.id}`} className="text-[var(--primary)] hover:underline">
                    {u.nev}
                  </Link>
                </td>
                <td className="px-3 py-2">{u.telefon || "—"}</td>
                <td className="px-3 py-2">{u.email || "—"}</td>
              </tr>
            ))}
            {ugyfelek.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nincs még ügyfél.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
