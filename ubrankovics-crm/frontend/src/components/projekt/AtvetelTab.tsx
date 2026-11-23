"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { api, Atvetel, Jegy } from "@/lib/api";

const INPUT = "w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";
const CARD = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4";

function ma() {
  return new Date().toISOString().slice(0, 10);
}

export default function AtvetelTab({ projektId }: { projektId: number }) {
  const [atvetelek, setAtvetelek] = useState<Atvetel[]>([]);
  const [jegyek, setJegyek] = useState<Jegy[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ datum: ma(), atado_nev: "", atvevo_nev: "", hibak: "", megjegyzes: "", garancia_honap: 24 });
  const [hiba, setHiba] = useState({ targy: "", leiras: "" });
  const [urlapNyitva, setUrlapNyitva] = useState<boolean | null>(null);
  const [betoltve, setBetoltve] = useState(false);

  const load = useCallback(() => {
    api.listAtvetelek(projektId).then((l) => { setAtvetelek(l); setBetoltve(true); }).catch((e) => setError(e.message));
    api.listProjektJegyek(projektId).then(setJegyek).catch(() => {});
  }, [projektId]);

  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await api.createAtvetel(projektId, { ...form, hibak: form.hibak || null, megjegyzes: form.megjegyzes || null });
      setForm({ ...form, hibak: "", megjegyzes: "" });
      setUrlapNyitva(false);
    });
  }

  function bejelent(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await api.garanciaHiba(projektId, { targy: hiba.targy, leiras: hiba.leiras || null });
      setHiba({ targy: "", leiras: "" });
    });
  }

  const garancia = atvetelek.find((a) => a.garancia_aktiv);
  const garanciaJegyek = jegyek.filter((j) => j.targy.startsWith("Garanciális hiba"));

  // A jegyzőkönyvek és a garancia vezetnek; az új jegyzőkönyv űrlapja csak akkor nyitott, ha még nincs, vagy kérik.
  const nyitva = urlapNyitva ?? (betoltve && atvetelek.length === 0);

  return (
    <div className="max-w-3xl space-y-4">
      {error && (
        <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
      <section className={`${CARD} space-y-3`} aria-labelledby="atvetel-lista">
        <div className="flex items-center justify-between gap-2">
          <h2 id="atvetel-lista" className="text-sm font-semibold">Jegyzőkönyvek</h2>
          {!nyitva && (
            <button onClick={() => setUrlapNyitva(true)} aria-expanded={false} className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
              Új jegyzőkönyv
            </button>
          )}
        </div>
        {atvetelek.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Még nincs rögzített átadás-átvétel.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]" data-testid="atvetel-lista">
            {atvetelek.map((a) => (
              <li key={a.id} className="space-y-2 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.datum} · {a.atvevo_nev}</div>
                    <div className="text-[var(--muted)]">Átadó: {a.atado_nev}</div>
                  </div>
                  <span className="rounded-[var(--radius)] bg-black/5 px-2 py-0.5 text-xs">
                    {a.allapot === "alairt" ? "Aláírva" : "Tervezet"}
                  </span>
                </div>
                {a.garancia_lejar && (
                  <div className="flex items-center gap-1 text-[var(--muted)]">
                    <ShieldCheck size={14} />
                    Garancia {a.garancia_aktiv ? "érvényes" : "lejárt"}: {a.garancia_lejar}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => run(() => api.openJegyzokonyv(a.id))} className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs">
                    <FileText size={12} /> Nyomtatható jegyzőkönyv
                  </button>
                  {a.allapot === "tervezet" && (
                    <>
                      <button onClick={() => run(() => api.alairAtvetel(a.id))} className="rounded-[var(--radius)] bg-[var(--primary)] px-2 py-1 text-xs text-[var(--primary-foreground)]">
                        Aláírás rögzítése
                      </button>
                      <button
                        onClick={() => confirm("Törlöd a tervezetet?") && run(() => api.deleteAtvetel(a.id))}
                        className="rounded-[var(--radius)] px-2 py-1 text-xs text-[var(--danger)]"
                      >
                        Törlés
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>


      {nyitva && (
      <section className={`${CARD} space-y-3`} aria-labelledby="atvetel-uj">
        <h2 id="atvetel-uj" className="text-sm font-semibold">Új átadás-átvételi jegyzőkönyv</h2>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="at-datum" className="text-sm font-medium">Átadás dátuma</label>
              <input id="at-datum" type="date" required className={INPUT} value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label htmlFor="at-garancia" className="text-sm font-medium">Garancia (hónap)</label>
              <input id="at-garancia" type="number" min={0} max={240} required className={INPUT} value={form.garancia_honap} onChange={(e) => setForm({ ...form, garancia_honap: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <label htmlFor="at-atado" className="text-sm font-medium">Átadó</label>
              <input id="at-atado" required className={INPUT} value={form.atado_nev} onChange={(e) => setForm({ ...form, atado_nev: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label htmlFor="at-atvevo" className="text-sm font-medium">Átvevő</label>
              <input id="at-atvevo" required className={INPUT} value={form.atvevo_nev} onChange={(e) => setForm({ ...form, atvevo_nev: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="at-hibak" className="text-sm font-medium">Feltárt hiányosságok</label>
            <textarea id="at-hibak" rows={3} className={INPUT} value={form.hibak} onChange={(e) => setForm({ ...form, hibak: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label htmlFor="at-megj" className="text-sm font-medium">Megjegyzés</label>
            <textarea id="at-megj" rows={2} className={INPUT} value={form.megjegyzes} onChange={(e) => setForm({ ...form, megjegyzes: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
              Jegyzőkönyv rögzítése
            </button>
            {atvetelek.length > 0 && (
              <button type="button" onClick={() => setUrlapNyitva(false)} className="px-3 py-1.5 text-sm text-[var(--muted)]">Mégse</button>
            )}
          </div>
        </form>
      </section>

      )}
      <section className={`${CARD} space-y-3`} aria-labelledby="garancia-hiba">
        <h2 id="garancia-hiba" className="text-sm font-semibold">Garanciális hibabejelentés</h2>
        {garancia ? (
          <form onSubmit={bejelent} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <label htmlFor="gh-targy" className="text-sm font-medium">Hiba rövid leírása</label>
              <input id="gh-targy" required className={INPUT} value={hiba.targy} onChange={(e) => setHiba({ ...hiba, targy: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label htmlFor="gh-leiras" className="text-sm font-medium">Részletek</label>
              <input id="gh-leiras" className={INPUT} value={hiba.leiras} onChange={(e) => setHiba({ ...hiba, leiras: e.target.value })} />
            </div>
            <button className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
              Hiba bejelentése
            </button>
          </form>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Hibabejelentéshez érvényes garancia kell: írd alá az átadás-átvételi jegyzőkönyvet, vagy a garancia már lejárt.
          </p>
        )}
        {garanciaJegyek.length > 0 && (
          <ul className="divide-y divide-[var(--border)] text-sm" data-testid="garancia-jegyek">
            {garanciaJegyek.map((j) => (
              <li key={j.id} className="flex justify-between gap-2 py-2">
                <span>{j.targy}</span>
                <span className="text-[var(--muted)]">{j.allapot}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
