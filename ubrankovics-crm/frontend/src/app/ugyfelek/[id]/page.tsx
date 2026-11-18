"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { api, Ugyfel } from "@/lib/api";

export default function UgyfelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ugyfel, setUgyfel] = useState<Ugyfel | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getUgyfel(Number(id)).then(setUgyfel).catch((e) => setError(e.message));
  }, [id]);

  async function save() {
    if (!ugyfel) return;
    setError("");
    try {
      const updated = await api.updateUgyfel(ugyfel.id, {
        nev: ugyfel.nev,
        telefon: ugyfel.telefon,
        email: ugyfel.email,
      });
      setUgyfel(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function remove() {
    if (!ugyfel || !confirm("Biztosan törlöd az ügyfelet?")) return;
    await api.deleteUgyfel(ugyfel.id);
    router.push("/ugyfelek");
  }

  if (!ugyfel) {
    return (
      <AppLayout>
        <p className="text-[var(--muted)]">{error || "Betöltés..."}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">{ugyfel.nev}</h1>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      <div className="max-w-md space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Név</label>
          <input
            className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
            value={ugyfel.nev}
            onChange={(e) => setUgyfel({ ...ugyfel, nev: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Telefon</label>
          <input
            className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
            value={ugyfel.telefon || ""}
            onChange={(e) => setUgyfel({ ...ugyfel, telefon: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">E-mail</label>
          <input
            className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
            value={ugyfel.email || ""}
            onChange={(e) => setUgyfel({ ...ugyfel, email: e.target.value })}
          />
        </div>
        <div className="flex justify-between pt-2">
          <button onClick={save} className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
            Mentés
          </button>
          <button onClick={remove} className="rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium text-[var(--danger)]">
            Törlés
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
