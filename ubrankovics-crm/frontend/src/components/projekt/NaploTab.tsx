"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { api, NaploBejegyzes } from "@/lib/api";

const INPUT = "w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";
const CARD = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4";

function Foto({ id, nev, onDelete }: { id: number; nev?: string | null; onDelete: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let eldobva = false;
    api.naploFotoUrl(id, true).then((u) => {
      if (eldobva) URL.revokeObjectURL(u);
      else {
        url = u;
        setSrc(u);
      }
    }).catch(() => {});
    return () => {
      eldobva = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return (
    <div className="group relative h-24 w-24 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-black/5">
      {src && (
        <button type="button" onClick={() => api.openNaploFoto(id)} aria-label={`Fotó megnyitása teljes méretben: ${nev || "építési fotó"}`} className="h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={nev || "Építési fotó"} className="h-full w-full object-cover" />
        </button>
      )}
      <button
        type="button"
        aria-label="Fotó törlése"
        onClick={onDelete}
        className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export default function NaploTab({ projektId }: { projektId: number }) {
  const [lista, setLista] = useState<NaploBejegyzes[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ datum: new Date().toISOString().slice(0, 10), idojaras: "", letszam: "", munka: "", megjegyzes: "" });
  const [fotok, setFotok] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.listNaplo(projektId).then(setLista).catch((e) => setError(e.message));
  }, [projektId]);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const b = await api.createNaplo(projektId, {
        datum: form.datum,
        idojaras: form.idojaras || null,
        letszam: form.letszam ? Number(form.letszam) : null,
        munka: form.munka,
        megjegyzes: form.megjegyzes || null,
      });
      for (const f of fotok) await api.uploadNaploFoto(b.id, f);
      setForm({ ...form, idojaras: "", letszam: "", munka: "", megjegyzes: "" });
      setFotok([]);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
      load();
    }
  }

  async function addFoto(id: number, files: FileList | null) {
    if (!files) return;
    setError("");
    try {
      for (const f of Array.from(files)) await api.uploadNaploFoto(id, f);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
      {error && (
        <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)] lg:col-span-2">
          {error}
        </div>
      )}
      <form onSubmit={create} className={`${CARD} h-fit space-y-3 lg:sticky lg:top-4`} aria-label="Új naplóbejegyzés">
        <h2 className="text-sm font-semibold">Új bejegyzés</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="nl-datum" className="text-sm font-medium">Dátum</label>
            <input id="nl-datum" type="date" required className={INPUT} value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label htmlFor="nl-letszam" className="text-sm font-medium">Létszám (fő)</label>
            <input id="nl-letszam" type="number" min={0} className={INPUT} value={form.letszam} onChange={(e) => setForm({ ...form, letszam: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="nl-ido" className="text-sm font-medium">Időjárás</label>
          <input id="nl-ido" className={INPUT} value={form.idojaras} onChange={(e) => setForm({ ...form, idojaras: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label htmlFor="nl-munka" className="text-sm font-medium">Elvégzett munka</label>
          <textarea id="nl-munka" required rows={3} className={INPUT} value={form.munka} onChange={(e) => setForm({ ...form, munka: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label htmlFor="nl-megj" className="text-sm font-medium">Megjegyzés</label>
          <textarea id="nl-megj" rows={2} className={INPUT} value={form.megjegyzes} onChange={(e) => setForm({ ...form, megjegyzes: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label htmlFor="nl-foto" className="text-sm font-medium">Fotók (telefonon a kamera is indítható)</label>
          <input
            id="nl-foto"
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="w-full text-sm"
            onChange={(e) => setFotok(Array.from(e.target.files || []))}
          />
        </div>
        <button className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
          Bejegyzés mentése
        </button>
      </form>

      <section aria-label="Naplóbejegyzések" className="space-y-3" data-testid="naplo-lista">
        {lista.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Még nincs naplóbejegyzés ehhez a projekthez.</p>
        ) : (
          lista.map((b) => (
            <article key={b.id} className={`${CARD} space-y-2 text-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{b.datum}</h3>
                <span className="text-[var(--muted)]">
                  {[b.idojaras, b.letszam != null ? `${b.letszam} fő` : null, b.szerzo?.full_name].filter(Boolean).join(" · ")}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{b.munka}</p>
              {b.megjegyzes && <p className="whitespace-pre-wrap text-[var(--muted)]">{b.megjegyzes}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {b.fotok.map((f) => (
                  <Foto key={f.id} id={f.id} nev={f.eredeti_nev} onDelete={() => api.deleteNaploFoto(f.id).then(load)} />
                ))}
                <label className="flex h-11 cursor-pointer items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 text-xs">
                  <Camera size={14} /> Fotó hozzáadása
                  <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addFoto(b.id, e.target.files)} />
                </label>
                <button
                  onClick={() => confirm("Törlöd a bejegyzést a fotókkal együtt?") && api.deleteNaplo(b.id).then(load)}
                  className="ml-auto rounded-[var(--radius)] px-2 py-1 text-xs text-[var(--danger)]"
                >
                  Törlés
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
