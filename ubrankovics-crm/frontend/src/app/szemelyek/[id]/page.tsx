"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Szemely, SzemelyProjektSzerep, SzemelyTetel, api } from "@/lib/api";

const SZAKASZ_LABEL: Record<string, string> = {
  ajanlat: "Ajánlat",
  szerzodes: "Szerződés",
  beszerzes: "Beszerzés",
  kivitelezes: "Kivitelezés",
  kesz: "Kész",
};

const SZEREP_LABEL: Record<string, string> = {
  epitesvezeto: "Építésvezető",
  projektfelelos: "Projektfelelős",
  muszaki_ellenor: "Műszaki ellenőr",
  epitesz_tervezo: "Építész tervező",
  gyartastervezo: "Gyártástervező",
};

export default function SzemelyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [szemely, setSzemely] = useState<Szemely | null>(null);
  const [szerepek, setSzerepek] = useState<SzemelyProjektSzerep[]>([]);
  const [tetelek, setTetelek] = useState<SzemelyTetel[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const sid = Number(id);
    api.getSzemely(sid).then(setSzemely).catch((e) => setError(e.message));
    api.listSzemelySzerepek(sid).then(setSzerepek).catch(() => {});
    api.listSzemelyTetelek(sid).then(setTetelek).catch(() => {});
  }, [id]);

  async function save() {
    if (!szemely) return;
    setError("");
    try {
      const updated = await api.updateSzemely(szemely.id, {
        nev: szemely.nev,
        telefon: szemely.telefon,
        email: szemely.email,
        szervezet: szemely.szervezet,
      });
      setSzemely(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function remove() {
    if (!szemely || !confirm("Biztosan törlöd a személyt?")) return;
    await api.deleteSzemely(szemely.id);
    router.push("/torzsadatok");
  }

  if (!szemely) {
    return (
      <AppLayout>
        <p className="text-[var(--muted)]">{error || "Betöltés..."}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">{szemely.nev}</h1>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="h-fit space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Név</label>
            <input
              className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              value={szemely.nev}
              onChange={(e) => setSzemely({ ...szemely, nev: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Telefon</label>
            <input
              className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              value={szemely.telefon || ""}
              onChange={(e) => setSzemely({ ...szemely, telefon: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">E-mail</label>
            <input
              className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              value={szemely.email || ""}
              onChange={(e) => setSzemely({ ...szemely, email: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Szervezet</label>
            <select
              className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              value={szemely.szervezet}
              onChange={(e) => setSzemely({ ...szemely, szervezet: e.target.value })}
            >
              <option value="belso">Belső</option>
              <option value="kulso">Külső</option>
            </select>
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

        <div className="space-y-4">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Projekt szerepek</h2>
            {szerepek.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nincs még szerephez rendelve.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {szerepek.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <Link href={`/projektek/${s.projekt_id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {s.projekt_nev}
                    </Link>
                    <span className="shrink-0 rounded-[var(--radius)] bg-black/5 px-2 py-0.5 text-xs">
                      {SZEREP_LABEL[s.szerep] || s.szerep}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Kijelölt tételek (ütemezés)</h2>
            {tetelek.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nincs még kijelölt tétel.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {tetelek.map((t) => (
                  <li key={t.tetel_id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <div>
                      <Link href={`/projektek/${t.projekt_id}`} className="font-medium text-[var(--primary)] hover:underline">
                        {t.projekt_nev}
                      </Link>
                      <div className="text-[var(--muted)]">{t.munkanem_nev}</div>
                    </div>
                    <span className="shrink-0 rounded-[var(--radius)] bg-black/5 px-2 py-0.5 text-xs">
                      {SZAKASZ_LABEL[t.szakasz] || t.szakasz}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
