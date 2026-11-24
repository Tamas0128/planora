"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AlertTriangle, LayoutGrid, List, MapPin, Plus, Search } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import AllapotPill from "@/components/AllapotPill";
import { api, ProjektListItem, ProjektTipus, Ugyfel } from "@/lib/api";

const ProjektekTerkep = dynamic(() => import("@/components/ProjektekTerkep"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-[var(--radius)] bg-[var(--border)]" aria-label="Térkép betöltése" />,
});

type Nezet = "lista" | "kartyak" | "terkep";
const NEZETEK: { v: Nezet; label: string; Icon: typeof List }[] = [
  { v: "lista", label: "Lista", Icon: List },
  { v: "kartyak", label: "Kártyák", Icon: LayoutGrid },
  { v: "terkep", label: "Térkép", Icon: MapPin },
];

function huDatum(d?: string | null) {
  return d ? d.replaceAll("-", ".") + "." : null;
}

function LejartJelveny({ db }: { db?: number }) {
  if (!db) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
      <AlertTriangle size={12} aria-hidden="true" /> Lejárt számla{db > 1 ? " (" + db + ")" : ""}
    </span>
  );
}

export default function ProjektekPage() {
  const [projektek, setProjektek] = useState<ProjektListItem[]>([]);
  const [ugyfelek, setUgyfelek] = useState<Ugyfel[]>([]);
  const [tipusok, setTipusok] = useState<ProjektTipus[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [projektNev, setProjektNev] = useState("");
  const [ugyfelId, setUgyfelId] = useState<string>("");
  const [epitesiCim, setEpitesiCim] = useState("");
  const [utemezesAktiv, setUtemezesAktiv] = useState(false);
  const [projektTipusId, setProjektTipusId] = useState<string>("");
  const [error, setError] = useState("");
  const [nezet, setNezet] = useState<Nezet>("lista");
  const [kereses, setKereses] = useState("");
  const [geoUzenet, setGeoUzenet] = useState("");
  const [geoFut, setGeoFut] = useState(false);
  const [lejart, setLejart] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    api.getPenzugyiOsszesito().then((o) => {
      const m = new Map<number, number>();
      for (const sz of o.lejart_szamlak) m.set(sz.projekt_id, (m.get(sz.projekt_id) || 0) + 1);
      setLejart(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("projekt-nezet");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tárolt beállítás betöltése csak kliensen lehetséges (SSR-egyezés)
      if (v === "lista" || v === "kartyak" || v === "terkep") setNezet(v);
      else if (window.innerWidth < 768) setNezet("kartyak"); // telefonon a kártyanézet az alapértelmezett: a táblázat oszlopai nem férnek ki
    } catch {
      // nincs tárhely: marad a lista
    }
  }, []);

  function valtNezet(v: Nezet) {
    setNezet(v);
    try {
      localStorage.setItem("projekt-nezet", v);
    } catch {
      // nem kritikus
    }
  }

  const szurt = projektek.filter((p) => {
    const q = kereses.trim().toLowerCase();
    if (!q) return true;
    return [p.projekt_nev, p.ugyfel_nev, p.epitesi_cim].some((x) => x?.toLowerCase().includes(q));
  });
  const terkepenNincs = szurt.filter((p) => p.latitude == null || p.longitude == null);
  const feloldhato = terkepenNincs.filter((p) => p.epitesi_cim).length;

  async function geokodol() {
    setGeoFut(true);
    setGeoUzenet("");
    try {
      const r = await api.geokodolasHianyzok();
      setGeoUzenet(
        `${r.feloldva} projekt címét sikerült feloldani${r.maradt > 0 ? `, további ${r.maradt} maradt — futtasd újra` : ""}.`
      );
      load();
    } catch (err) {
      setGeoUzenet(err instanceof Error ? err.message : "A címfeloldás nem sikerült");
    } finally {
      setGeoFut(false);
    }
  }

  function load() {
    api.listProjektek().then(setProjektek).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api.listUgyfelek().then(setUgyfelek).catch(() => {});
    api.listProjektTipusok().then(setTipusok).catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createProjekt({
        projekt_nev: projektNev,
        utemezes_aktiv: utemezesAktiv,
        projekt_tipus_id: projektTipusId ? Number(projektTipusId) : null,
        ugyfelek: ugyfelId
          ? [{ ugyfel_id: Number(ugyfelId), epitesi_cim: epitesiCim || null }]
          : [],
      });
      setProjektNev("");
      setUgyfelId("");
      setEpitesiCim("");
      setUtemezesAktiv(false);
      setProjektTipusId("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projektek</h1>
        <div className="flex items-center gap-2">
          <Link href="/projektek/import" className="flex min-h-9 items-center rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm">
            Átvétel Excelből
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <Plus size={16} /> Új projekt
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 grid max-w-xl grid-cols-2 gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <input
            placeholder="Projekt neve"
            required
            value={projektNev}
            onChange={(e) => setProjektNev(e.target.value)}
            className="col-span-2 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <select
            value={ugyfelId}
            onChange={(e) => setUgyfelId(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            <option value="">Ügyfél (opcionális)</option>
            {ugyfelek.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nev}
              </option>
            ))}
          </select>
          <input
            placeholder="Építési cím"
            value={epitesiCim}
            onChange={(e) => setEpitesiCim(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <select
            value={projektTipusId}
            onChange={(e) => setProjektTipusId(e.target.value)}
            className="col-span-2 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            <option value="">Épülettípus (opcionális fázis-sablon)</option>
            {tipusok.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nev}
              </option>
            ))}
          </select>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={utemezesAktiv} onChange={(e) => setUtemezesAktiv(e.target.checked)} />
            Ütemező bekapcsolása ennél a projektnél
          </label>
          <button
            type="submit"
            className="col-span-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]"
          >
            Mentés
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Nézet" className="flex overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          {NEZETEK.map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              aria-pressed={nezet === v}
              onClick={() => valtNezet(v)}
              className={`flex min-h-9 items-center gap-1.5 px-3 text-sm ${
                nezet === v ? "bg-[var(--primary)] font-medium text-[var(--primary-foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <label className="relative">
          <span className="sr-only">Keresés a projektek között</span>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            placeholder="Név, ügyfél vagy cím"
            value={kereses}
            onChange={(e) => setKereses(e.target.value)}
            className="w-64 max-w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] py-1.5 pl-8 pr-2 text-sm"
          />
        </label>
        <span className="text-sm text-[var(--muted)]">{szurt.length} projekt</span>
      </div>

      {nezet === "terkep" && (
        <div className="space-y-2" data-testid="projekt-terkep">
          <ProjektekTerkep projektek={szurt} />
          {terkepenNincs.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
              <span>{terkepenNincs.length} projekthez nincs térképi pozíció.</span>
              {feloldhato > 0 && (
                <button
                  type="button"
                  onClick={geokodol}
                  disabled={geoFut}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[var(--foreground)] disabled:opacity-60"
                >
                  {geoFut ? "Feloldás folyamatban…" : `Címek feloldása (${feloldhato})`}
                </button>
              )}
              {feloldhato > 0 && <span className="text-xs">A címeket az OpenStreetMap szolgáltatásnak küldjük el.</span>}
              {geoUzenet && <span role="status" className="text-[var(--foreground)]">{geoUzenet}</span>}
            </div>
          )}
        </div>
      )}

      {nezet === "kartyak" && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="projekt-kartyak">
          {szurt.map((p) => {
            const szazalek = Math.max(0, Math.min(100, Number(p.completion_percent ?? 0)));
            return (
              <li key={p.id}>
                <Link
                  href={`/projektek/${p.id}`}
                  className="flex h-full flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--primary)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-heading text-base font-semibold leading-snug">{p.projekt_nev}</h2>
                    <span className="flex flex-col items-end gap-1">
                      <AllapotPill allapot={p.allapot} />
                      <LejartJelveny db={lejart.get(p.id)} />
                    </span>
                  </div>
                  <div className="space-y-0.5 text-sm">
                    {p.ugyfel_nev && <div>{p.ugyfel_nev}</div>}
                    <div className="text-[var(--muted)]">{p.epitesi_cim || "Nincs építési cím"}</div>
                  </div>
                  <div className="mt-auto space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                        <span>Készültség</span>
                        <span>{szazalek.toLocaleString("hu-HU", { maximumFractionDigits: 0 })}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--border)]" aria-hidden="true">
                        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${szazalek}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-3 text-xs text-[var(--muted)]">
                      <span>{p.tetel_db ?? 0} tétel</span>
                      {huDatum(p.delivery_date) && <span>Átadás: {huDatum(p.delivery_date)}</span>}
                      {p.utemezes_aktiv && <span>Ütemező aktív</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {szurt.length === 0 && <li className="col-span-full py-6 text-center text-[var(--muted)]">Nincs a keresésnek megfelelő projekt.</li>}
        </ul>
      )}

      {nezet === "lista" && (
      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Projekt</th>
              <th className="px-3 py-2">Ügyfél</th>
              <th className="px-3 py-2">Állapot</th>
              <th className="px-3 py-2">Készültség</th>
              <th className="px-3 py-2">Átadás</th>
            </tr>
          </thead>
          <tbody>
            {szurt.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <Link href={`/projektek/${p.id}`} className="text-[var(--primary)] hover:underline">
                    {p.projekt_nev}
                  </Link>
                </td>
                <td className="px-3 py-2 text-[var(--muted)]">{p.ugyfel_nev || "—"}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <AllapotPill allapot={p.allapot} />
                    <LejartJelveny db={lejart.get(p.id)} />
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full bg-[var(--border)]" aria-hidden="true">
                      <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(0, Math.min(100, Number(p.completion_percent ?? 0)))}%` }} />
                    </div>
                    <span className="tabular-nums text-xs text-[var(--muted)]">{Math.round(Number(p.completion_percent ?? 0))}%</span>
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--muted)]">{huDatum(p.delivery_date) || "—"}</td>
              </tr>
            ))}
            {szurt.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nincs a keresésnek megfelelő projekt. Új projektet a fenti gombbal indíthatsz.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </AppLayout>
  );
}
