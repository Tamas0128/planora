"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Download, GitMerge, Plus, Upload } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Modal from "@/components/Modal";
import { api, downloadFile, Ugyfel, UgyfelDuplikatumCsoport, UgyfelImportValasz } from "@/lib/api";

export default function UgyfelekPage() {
  const [ugyfelek, setUgyfelek] = useState<Ugyfel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nev, setNev] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [importEredmeny, setImportEredmeny] = useState<UgyfelImportValasz | null>(null);
  const [duplikatumok, setDuplikatumok] = useState<UgyfelDuplikatumCsoport[] | null>(null);

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      setImportEredmeny(await api.importUgyfelek(file));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function exportal(format: "csv" | "xlsx") {
    try {
      await downloadFile(`/ugyfelek/export?format=${format}`, `ugyfelek.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function megnyitDuplikatumok() {
    try {
      setDuplikatumok(await api.listUgyfelDuplikatumok());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function egyesit(celId: number, forrasId: number) {
    if (!confirm("Egyesíted? A másik ügyfél törlődik, adatai átkerülnek ide.")) return;
    try {
      await api.egyesitUgyfelek(celId, forrasId);
      setDuplikatumok(await api.listUgyfelDuplikatumok());
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

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
        <div className="flex gap-2">
          <button onClick={() => exportal("csv")} className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportal("xlsx")} className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
            <Download size={14} /> Excel
          </button>
          <label className="flex cursor-pointer items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
            <Upload size={14} /> Import
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              data-testid="ugyfel-import-input"
              onChange={(e) => {
                handleImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button onClick={megnyitDuplikatumok} className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
            <GitMerge size={14} /> Duplikátumok
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <Plus size={16} /> Új ügyfél
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {importEredmeny && (
        <div className="mb-4 flex items-start justify-between rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
          <div>
            Import kész: {importEredmeny.letrehozva} új ügyfél, {importEredmeny.kihagyva_duplikatum} duplikátum kihagyva
            {importEredmeny.hibas_sorok.length > 0 && `, ${importEredmeny.hibas_sorok.length} hibás sor (${importEredmeny.hibas_sorok.join("; ")})`}.
            <div className="text-xs text-[var(--muted)]">Elvárt oszlopok: nev, telefon, email (.csv vagy .xlsx).</div>
          </div>
          <button onClick={() => setImportEredmeny(null)} className="text-[var(--muted)]">×</button>
        </div>
      )}

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
      {duplikatumok && (
        <Modal title="Duplikátum ügyfelek" onClose={() => setDuplikatumok(null)} wide>
          {duplikatumok.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nincs duplikátum.</p>
          ) : (
            <div className="space-y-4">
              {duplikatumok.map((cs, i) => (
                <div key={i} className="rounded-[var(--radius)] border border-[var(--border)] p-2">
                  <div className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">{cs.ok}</div>
                  {cs.ugyfelek.map((x) => (
                    <div key={x.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span>
                        #{x.id} {x.nev} · {x.email || "—"} · {x.telefon || "—"}
                      </span>
                      <span className="flex gap-1">
                        {cs.ugyfelek
                          .filter((y) => y.id !== x.id)
                          .map((y) => (
                            <button
                              key={y.id}
                              onClick={() => egyesit(x.id, y.id)}
                              className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-0.5 text-xs"
                            >
                              #{y.id} beolvasztása ide
                            </button>
                          ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </AppLayout>
  );
}
