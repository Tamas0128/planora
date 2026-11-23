"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjektDetail, api } from "@/lib/api";

const ALLAPOTOK: { v: string; label: string }[] = [
  { v: "uj", label: "Új" },
  { v: "ajanlat", label: "Ajánlat" },
  { v: "szerzodott", label: "Szerződött" },
  { v: "kivitelezes", label: "Kivitelezés" },
  { v: "lezart", label: "Lezárt" },
];

const inputCls = "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm";

// A projekt alapbeállításai és az ütemező adminisztrációja egy helyen.
export default function BeallitasokTab({ projekt, onChange }: { projekt: ProjektDetail; onChange: () => void }) {
  const router = useRouter();
  const [nev, setNev] = useState(projekt.projekt_nev);
  const [allapot, setAllapot] = useState<string>(projekt.allapot);
  const [atadas, setAtadas] = useState(projekt.delivery_date ?? "");
  const [hrsz, setHrsz] = useState(projekt.hrsz ?? "");
  const [enaplo, setEnaplo] = useState(projekt.enaplo_iktatoszam ?? "");
  const [mappa, setMappa] = useState(projekt.mappa_utvonal ?? "");
  const [lat, setLat] = useState(projekt.latitude != null ? String(projekt.latitude) : "");
  const [lon, setLon] = useState(projekt.longitude != null ? String(projekt.longitude) : "");
  const [uzenet, setUzenet] = useState("");
  const [hiba, setHiba] = useState("");

  async function mentes(e: FormEvent) {
    e.preventDefault();
    setHiba("");
    setUzenet("");
    try {
      await api.updateProjekt(projekt.id, {
        projekt_nev: nev.trim(),
        allapot,
        delivery_date: atadas || null,
        hrsz: hrsz || null,
        enaplo_iktatoszam: enaplo || null,
        mappa_utvonal: mappa || null,
        latitude: lat === "" ? null : Number(lat.replace(",", ".")),
        longitude: lon === "" ? null : Number(lon.replace(",", ".")),
      });
      setUzenet("Mentve.");
      onChange();
    } catch (err) {
      setHiba(err instanceof Error ? err.message : "A mentés nem sikerült");
    }
  }

  async function utemezoKapcsol(on: boolean) {
    setHiba("");
    try {
      await api.updateProjekt(projekt.id, { utemezes_aktiv: on });
      onChange();
    } catch (err) {
      setHiba(err instanceof Error ? err.message : "A módosítás nem sikerült");
    }
  }

  async function torol() {
    if (!confirm(`Biztosan törlöd a projektet: ${projekt.projekt_nev}? A művelet nem vonható vissza.`)) return;
    try {
      await api.deleteProjekt(projekt.id);
      router.push("/projektek");
    } catch (err) {
      setHiba(err instanceof Error ? err.message : "A törlés nem sikerült");
    }
  }

  return (
    <div className="grid max-w-3xl gap-6">
      {hiba && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{hiba}</div>}

      <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-1 text-sm font-semibold">Ütemező</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Bekapcsolva a projekt tételeihez kezdő- és befejező dátum, felelős és függőség rendelhető, a rendszer pedig kiszámolja a határidőket és a Gantt-diagramot (Ütemezés fül).
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={projekt.utemezes_aktiv} onChange={(e) => utemezoKapcsol(e.target.checked)} />
          Ütemező aktív ennél a projektnél
        </label>
      </section>

      <form onSubmit={mentes} className="space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4" aria-label="Projekt alapadatai">
        <h2 className="text-sm font-semibold">Alapadatok</h2>
        <label className="block text-sm">
          Projekt neve
          <input className={inputCls} value={nev} onChange={(e) => setNev(e.target.value)} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Állapot
            <select className={inputCls} value={allapot} onChange={(e) => setAllapot(e.target.value)}>
              {ALLAPOTOK.map((a) => (
                <option key={a.v} value={a.v}>{a.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Átadási határidő
            <input type="date" className={inputCls} value={atadas} onChange={(e) => setAtadas(e.target.value)} />
          </label>
          <label className="block text-sm">
            Helyrajzi szám
            <input className={inputCls} value={hrsz} onChange={(e) => setHrsz(e.target.value)} />
          </label>
          <label className="block text-sm">
            E-napló iktatószám
            <input className={inputCls} value={enaplo} onChange={(e) => setEnaplo(e.target.value)} />
          </label>
          <label className="block text-sm sm:col-span-2">
            Mappa útvonal
            <input className={inputCls} value={mappa} onChange={(e) => setMappa(e.target.value)} />
          </label>
          <label className="block text-sm">
            Szélesség (térkép)
            <input inputMode="decimal" className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label className="block text-sm">
            Hosszúság (térkép)
            <input inputMode="decimal" className={inputCls} value={lon} onChange={(e) => setLon(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-4 py-1.5 text-sm text-[var(--primary-foreground)]">
            Mentés
          </button>
          {uzenet && <span role="status" className="text-sm text-[var(--muted)]">{uzenet}</span>}
        </div>
      </form>

      <section className="rounded-[var(--radius)] border border-[var(--danger)]/40 bg-[var(--card)] p-4">
        <h2 className="mb-1 text-sm font-semibold">Projekt törlése</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">A projekt és minden hozzá tartozó adat (tételek, napló, dokumentumok) törlődik.</p>
        <button onClick={torol} className="rounded-[var(--radius)] border border-[var(--danger)] px-3 py-1.5 text-sm text-[var(--danger)]">
          Projekt törlése
        </button>
      </section>
    </div>
  );
}
