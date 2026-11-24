"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, ExcelImportEredmeny } from "@/lib/api";

export default function ProjektImportPage() {
  const router = useRouter();
  const [fajl, setFajl] = useState<File | null>(null);
  const [elonezet, setElonezet] = useState<ExcelImportEredmeny | null>(null);
  const [hiba, setHiba] = useState("");
  const [dolgozik, setDolgozik] = useState(false);

  async function nez(e: FormEvent) {
    e.preventDefault();
    if (!fajl) return;
    setHiba("");
    setDolgozik(true);
    try {
      setElonezet(await api.importExcel(fajl, true));
    } catch (err) {
      setElonezet(null);
      setHiba(err instanceof Error ? err.message : "Hiba az átvételkor");
    } finally {
      setDolgozik(false);
    }
  }

  async function atvesz() {
    if (!fajl) return;
    setDolgozik(true);
    setHiba("");
    try {
      const r = await api.importExcel(fajl, false);
      router.push(`/projektek/${r.projekt_id}`);
    } catch (err) {
      setHiba(err instanceof Error ? err.message : "Hiba az átvételkor");
      setDolgozik(false);
    }
  }

  const s = elonezet?.statisztika;
  return (
    <AppLayout>
      <nav aria-label="Morzsamenü" className="mb-3 text-sm text-[var(--muted)]">
        <Link href="/projektek" className="text-[var(--primary)] hover:underline">Projektek</Link> › Átvétel Excelből
      </nav>
      <h1 className="mb-1 text-xl font-semibold">Projekt átvétele Excelből</h1>
      <p className="mb-4 max-w-2xl text-sm text-[var(--muted)]">
        Töltse fel a kitöltött alap-sablont (Ubrankovics_projekt_alap.xlsx). Előbb előnézetet mutatunk, a projekt csak a jóváhagyás után jön létre.
      </p>
      <form onSubmit={nez} className="mb-4 flex max-w-xl flex-wrap items-end gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block font-medium">Excel-fájl (.xlsx)</span>
          <input type="file" accept=".xlsx" onChange={(e) => { setFajl(e.target.files?.[0] ?? null); setElonezet(null); }} className="w-full text-sm" />
        </label>
        <button disabled={!fajl || dolgozik} className="flex min-h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--primary)] px-4 text-sm font-medium text-[var(--primary)] disabled:opacity-50">
          <FileSpreadsheet size={16} aria-hidden="true" /> Előnézet
        </button>
      </form>
      {hiba && <div role="alert" className="mb-4 max-w-xl rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{hiba}</div>}
      {elonezet && s && (
        <section aria-label="Átvétel előnézete" className="max-w-xl rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4" data-testid="import-elonezet">
          <h2 className="mb-2 text-sm font-semibold">{elonezet.projekt_nev}</h2>
          <ul className="space-y-1 text-sm">
            <li>{s.tetelek} tétel, {s.esemenyek} folyamat-állapot</li>
            <li>{s.cr} pótmunka (CR), {s.szerepek} szerepkör</li>
            {s.uj_munkanem > 0 && <li>{s.uj_munkanem} új munkanem jön létre a törzsadatban</li>}
          </ul>
          {elonezet.figyelmeztetesek.map((f) => (
            <p key={f} className="mt-2 rounded-[var(--radius)] bg-[var(--warning-bg)] px-3 py-2 text-sm">{f}</p>
          ))}
          <button onClick={atvesz} disabled={dolgozik} className="mt-3 min-h-10 rounded-[var(--radius)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50">
            Átvétel jóváhagyása
          </button>
        </section>
      )}
    </AppLayout>
  );
}
