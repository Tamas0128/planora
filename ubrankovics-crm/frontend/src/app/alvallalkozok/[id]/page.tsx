"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import {
  Alvallalkozo,
  AlvallalkozoiSzamla,
  AlvallalkozoTetel,
  Tig,
  api,
} from "@/lib/api";

const SZAKASZ_LABEL: Record<string, string> = {
  ajanlat: "Ajánlat",
  szerzodes: "Szerződés",
  beszerzes: "Beszerzés",
  kivitelezes: "Kivitelezés",
  kesz: "Kész",
};

function huf(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toLocaleString("hu-HU")} Ft`;
}

export default function AlvallalkozoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [alvallalkozo, setAlvallalkozo] = useState<Alvallalkozo | null>(null);
  const [tetelek, setTetelek] = useState<AlvallalkozoTetel[]>([]);
  const [tig, setTig] = useState<Tig[]>([]);
  const [szamlak, setSzamlak] = useState<AlvallalkozoiSzamla[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const aid = Number(id);
    api.getAlvallalkozo(aid).then(setAlvallalkozo).catch((e) => setError(e.message));
    api.listAlvallalkozoTetelek(aid).then(setTetelek).catch(() => {});
    api.listAlvallalkozoTig(aid).then(setTig).catch(() => {});
    api.listAlvallalkozoSzamlak(aid).then(setSzamlak).catch(() => {});
  }, [id]);

  async function save() {
    if (!alvallalkozo) return;
    setError("");
    try {
      const updated = await api.updateAlvallalkozo(alvallalkozo.id, {
        nev: alvallalkozo.nev,
        kapcsolat: alvallalkozo.kapcsolat,
      });
      setAlvallalkozo(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function remove() {
    if (!alvallalkozo || !confirm("Biztosan törlöd az alvállalkozót?")) return;
    await api.deleteAlvallalkozo(alvallalkozo.id);
    router.push("/torzsadatok");
  }

  if (!alvallalkozo) {
    return (
      <AppLayout>
        <p className="text-[var(--muted)]">{error || "Betöltés..."}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">{alvallalkozo.nev}</h1>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="h-fit space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Név</label>
            <input
              className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              value={alvallalkozo.nev}
              onChange={(e) => setAlvallalkozo({ ...alvallalkozo, nev: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Kapcsolat</label>
            <input
              className="w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
              value={alvallalkozo.kapcsolat || ""}
              onChange={(e) => setAlvallalkozo({ ...alvallalkozo, kapcsolat: e.target.value })}
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

        <div className="space-y-4">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Tételek, amiken vállalóként szerepel</h2>
            {tetelek.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nincs még hozzárendelt tétel.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {tetelek.map((t) => (
                  <li key={t.vallalas_id} className="flex items-center justify-between gap-4 py-2 text-sm">
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

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Teljesítésigazolások (TIG)</h2>
            {tig.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nincs még TIG.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {tig.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <Link href={`/projektek/${t.projekt_id}`} className="text-[var(--primary)] hover:underline">
                      {t.idoszak_kezdet} – {t.idoszak_veg}
                    </Link>
                    <span>{huf(t.brutto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Alvállalkozói számlák</h2>
            {szamlak.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Nincs még számla.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {szamlak.map((sz) => (
                  <li key={sz.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <div>
                      <Link href={`/projektek/${sz.projekt_id}`} className="font-medium text-[var(--primary)] hover:underline">
                        {sz.szamlaszam}
                      </Link>
                      <div className="text-[var(--muted)]">esedékes: {sz.esedekesseg}</div>
                    </div>
                    <span>
                      {huf(sz.hatralek)} hátralék / {huf(sz.brutto)}
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
