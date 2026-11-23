"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import KommunikacioNaplo from "@/components/KommunikacioNaplo";
import Modal from "@/components/Modal";
import { api, Erdeklodes, ErdeklodesAllapot, PipelineSzakasz } from "@/lib/api";

const SZAKASZOK: { allapot: ErdeklodesAllapot; label: string }[] = [
  { allapot: "uj", label: "Új" },
  { allapot: "kapcsolatfelvetel", label: "Kapcsolatfelvétel" },
  { allapot: "ajanlat", label: "Ajánlat" },
  { allapot: "targyalas", label: "Tárgyalás" },
  { allapot: "nyert", label: "Nyert" },
  { allapot: "elveszett", label: "Elveszett" },
];

const forint = (v: string | number) => `${Math.round(Number(v)).toLocaleString("hu-HU")} Ft`;

const inputCls = "w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";

export default function ErdeklodokPage() {
  const router = useRouter();
  const [lista, setLista] = useState<Erdeklodes[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSzakasz[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nev, setNev] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [forras, setForras] = useState("");
  const [ertek, setErtek] = useState("");
  const [error, setError] = useState("");
  const [nyitott, setNyitott] = useState<Erdeklodes | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);

  function load() {
    api.listErdeklodok().then(setLista).catch((e) => setError(e.message));
    api.getPipeline().then(setPipeline).catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createErdeklodes({
        nev,
        telefon: telefon || null,
        email: email || null,
        forras: forras || null,
        becsult_ertek: ertek || null,
      });
      setNev("");
      setTelefon("");
      setEmail("");
      setForras("");
      setErtek("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function mozgat(id: number, allapot: ErdeklodesAllapot) {
    setError("");
    try {
      await api.updateErdeklodes(id, { allapot });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function konvertal(l: Erdeklodes) {
    if (!confirm(`${l.nev} ügyféllé alakítása?`)) return;
    try {
      const ugyfel = await api.konvertalErdeklodes(l.id);
      router.push(`/ugyfelek/${ugyfel.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function torol(l: Erdeklodes) {
    if (!confirm(`${l.nev} törlése?`)) return;
    await api.deleteErdeklodes(l.id);
    setNyitott(null);
    load();
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Érdeklődők</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
        >
          <Plus size={16} /> Új érdeklődő
        </button>
      </div>

      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 grid max-w-2xl grid-cols-4 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <input placeholder="Név" required value={nev} onChange={(e) => setNev(e.target.value)} className={`col-span-4 ${inputCls}`} />
          <input placeholder="Telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} className={`col-span-2 ${inputCls}`} />
          <input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={`col-span-2 ${inputCls}`} />
          <input placeholder="Forrás (pl. ajánlás)" value={forras} onChange={(e) => setForras(e.target.value)} className={`col-span-2 ${inputCls}`} />
          <input placeholder="Becsült érték (Ft)" type="number" min="0" value={ertek} onChange={(e) => setErtek(e.target.value)} className={`col-span-2 ${inputCls}`} />
          <button type="submit" className="col-span-4 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
            Mentés
          </button>
        </form>
      )}

      <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${SZAKASZOK.length}, minmax(13rem, 1fr))` }}>
        {SZAKASZOK.map(({ allapot, label }) => {
          const oszlop = lista.filter((l) => l.allapot === allapot);
          const p = pipeline.find((x) => x.allapot === allapot);
          return (
            <div
              key={allapot}
              data-testid={`oszlop-${allapot}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId != null) mozgat(dragId, allapot);
                setDragId(null);
              }}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-black/[0.03] p-2"
            >
              <div className="mb-2 px-1">
                <div className="text-sm font-semibold">
                  {label} <span className="font-normal text-[var(--muted)]">({oszlop.length})</span>
                </div>
                <div className="text-xs text-[var(--muted)]">{forint(p?.ertek_osszesen ?? 0)}</div>
              </div>
              <div className="space-y-2">
                {oszlop.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-2 text-sm"
                  >
                    <button onClick={() => setNyitott(l)} className="text-left font-medium text-[var(--primary)] hover:underline">
                      {l.nev}
                    </button>
                    {l.becsult_ertek && <div className="text-xs text-[var(--muted)]">{forint(l.becsult_ertek)}</div>}
                    {l.forras && <div className="text-xs text-[var(--muted)]">{l.forras}</div>}
                    <select
                      aria-label={`${l.nev} szakasz`}
                      value={l.allapot}
                      onChange={(e) => mozgat(l.id, e.target.value as ErdeklodesAllapot)}
                      className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] px-1 py-0.5 text-xs"
                    >
                      {SZAKASZOK.map((s) => (
                        <option key={s.allapot} value={s.allapot}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {nyitott && (
        <Modal title={nyitott.nev} onClose={() => setNyitott(null)} wide>
          <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div>Telefon: {nyitott.telefon || "—"}</div>
            <div>E-mail: {nyitott.email || "—"}</div>
            <div>Forrás: {nyitott.forras || "—"}</div>
            <div>Felelős: {nyitott.owner?.full_name || "—"}</div>
            {nyitott.becsult_ertek && <div>Becsült érték: {forint(nyitott.becsult_ertek)}</div>}
          </div>
          <div className="mb-4 flex gap-2">
            {nyitott.ugyfel_id ? (
              <button
                onClick={() => router.push(`/ugyfelek/${nyitott.ugyfel_id}`)}
                className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Ügyfélkártya megnyitása
              </button>
            ) : (
              <button
                onClick={() => konvertal(nyitott)}
                className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
              >
                Ügyféllé alakítás
              </button>
            )}
            <button onClick={() => torol(nyitott)} className="rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium text-[var(--danger)]">
              Törlés
            </button>
          </div>
          <KommunikacioNaplo erdeklodesId={nyitott.id} />
        </Modal>
      )}
    </AppLayout>
  );
}
