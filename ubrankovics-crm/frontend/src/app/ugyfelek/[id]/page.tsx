"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import EgyediMezok from "@/components/EgyediMezok";
import KommunikacioNaplo from "@/components/KommunikacioNaplo";
import UgyfelCimkek from "@/components/UgyfelCimkek";
import { api, Ugyfel, UgyfelProjektLink, UserResponse } from "@/lib/api";

const ALLAPOT_LABEL: Record<string, string> = {
  uj: "Új",
  ajanlat: "Ajánlat",
  szerzodott: "Szerződött",
  kivitelezes: "Kivitelezés",
  lezart: "Lezárt",
};

export default function UgyfelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ugyfel, setUgyfel] = useState<Ugyfel | null>(null);
  const [projektek, setProjektek] = useState<UgyfelProjektLink[]>([]);
  const [error, setError] = useState("");
  const [me, setMe] = useState<UserResponse | null>(null);

  useEffect(() => {
    api.getUgyfel(Number(id)).then(setUgyfel).catch((e) => setError(e.message));
    api.listUgyfelProjektek(Number(id)).then(setProjektek).catch(() => {});
    api.me().then(setMe).catch(() => {});
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
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="h-fit space-y-4">
        <div className="space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
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
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <UgyfelCimkek ugyfelId={ugyfel.id} />
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <EgyediMezok entitas="ugyfel" entitasId={ugyfel.id} isAdmin={me?.role === "admin"} />
        </div>
        </div>

        <div className="space-y-4">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Projektek</h2>
          {projektek.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Ehhez az ügyfélhez még nincs projekt hozzárendelve.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {projektek.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <div>
                    <Link href={`/projektek/${p.projekt_id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {p.projekt_nev}
                    </Link>
                    <div className="text-[var(--muted)]">
                      {p.epitesi_cim || "—"}
                      {p.szerep ? ` · ${p.szerep}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-[var(--radius)] bg-black/5 px-2 py-0.5 text-xs">
                    {ALLAPOT_LABEL[p.allapot] || p.allapot}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <KommunikacioNaplo ugyfelId={ugyfel.id} />
        </div>
        </div>
      </div>
    </AppLayout>
  );
}
