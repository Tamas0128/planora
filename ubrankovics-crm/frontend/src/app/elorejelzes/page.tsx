"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, Elorejelzes } from "@/lib/api";

const forint = (v: string | number) => `${Math.round(Number(v)).toLocaleString("hu-HU")} Ft`;

const SZAKASZ_LABEL: Record<string, string> = {
  uj: "Új",
  kapcsolatfelvetel: "Kapcsolatfelvétel",
  ajanlat: "Ajánlat",
  targyalas: "Tárgyalás",
  nyert: "Nyert",
  elveszett: "Elveszett",
};

export default function ElorejelzesPage() {
  const [adat, setAdat] = useState<Elorejelzes | null>(null);
  const [error, setError] = useState("");
  const [szerk, setSzerk] = useState<Record<string, string>>({});

  function load() {
    api.getElorejelzes(6).then(setAdat).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function celMentes(honap: string) {
    setError("");
    try {
      await api.setErtekesitesiCel(honap, (szerk[honap] ?? "0").trim() || "0");
      setSzerk((s) => {
        const { [honap]: _, ...rest } = s;
        return rest;
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  if (!adat) {
    return (
      <AppLayout>
        <p className="text-[var(--muted)]">{error || "Betöltés..."}</p>
      </AppLayout>
    );
  }

  const max = Math.max(1, ...adat.honapok.flatMap((h) => [Number(h.sulyozott_osszeg) + Number(h.nyert_osszeg), Number(h.cel ?? 0)]));

  return (
    <AppLayout>
      <h1 className="mb-1 text-xl font-semibold">Értékesítési előrejelzés</h1>
      <p className="mb-3 max-w-3xl text-sm text-[var(--muted)]">
        Mennyi bevételre számíthatunk a következő hónapokban az érdeklődőkből? Minden nyitott érdeklődő értékét a szakaszához tartozó esélylyel szorozzuk, és abba a hónapba soroljuk, amikorra a lezárását várjuk.
      </p>
      <section aria-label="Összesítés" className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Várható bevétel (súlyozott)</div>
          <div className="mt-1 font-heading text-2xl font-semibold tabular-nums">{forint(adat.sulyozott_osszesen)}</div>
        </div>
        <details className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <summary className="cursor-pointer font-medium">Hogyan számoljuk? (példa)</summary>
          <p className="mt-2 text-[var(--muted)]">
            Egy 10 millió Ft-os ajánlat <strong>Ajánlat</strong> szakaszban 50% eséllyel nyerhető, ezért 5 millió Ft-tal szerepel a „Súlyozott” oszlopban. Ha megnyerjük, átkerül a „Nyert” oszlopba a teljes összeggel; ha elveszik, kiesik. A „Cél” oszlopban havi értékesítési célt állíthat be, a sáv pedig azt mutatja, a nyert és a súlyozott érték együtt hány százalékát fedi ennek.
          </p>
        </details>
      </section>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}

      <div tabIndex={0} className="mb-6 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Hónap</th>
              <th className="px-3 py-2">Nyert<span className="block text-xs font-normal text-[var(--muted)]">megnyert munkák értéke</span></th>
              <th className="px-3 py-2">Nyitott (nyers)<span className="block text-xs font-normal text-[var(--muted)]">még döntésre vár, teljes érték</span></th>
              <th className="px-3 py-2">Súlyozott<span className="block text-xs font-normal text-[var(--muted)]">nyitott érték × esély</span></th>
              <th className="px-3 py-2">Cél<span className="block text-xs font-normal text-[var(--muted)]">saját havi cél, írja be</span></th>
              <th className="w-56 px-3 py-2">Teljesülés<span className="block text-xs font-normal text-[var(--muted)]">(nyert + súlyozott) / cél</span></th>
            </tr>
          </thead>
          <tbody>
            {adat.honapok.map((h) => {
              const varhato = Number(h.sulyozott_osszeg) + Number(h.nyert_osszeg);
              const cel = h.cel ? Number(h.cel) : 0;
              return (
                <tr key={h.honap} className="border-t border-[var(--border)]" data-testid={`honap-${h.honap}`}>
                  <td className="px-3 py-2 font-medium">{h.honap}</td>
                  <td className="px-3 py-2">{forint(h.nyert_osszeg)}</td>
                  <td className="px-3 py-2">{forint(h.nyitott_osszeg)}</td>
                  <td className="px-3 py-2">{forint(h.sulyozott_osszeg)}</td>
                  <td className="px-3 py-2">
                    <input
                      inputMode="numeric"
                      placeholder="—"
                      aria-label={`${h.honap} cél`}
                      value={szerk[h.honap] ?? (h.cel ? String(Math.round(Number(h.cel))) : "")}
                      onChange={(e) => setSzerk({ ...szerk, [h.honap]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && celMentes(h.honap)}
                      className="w-28 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-sm"
                    />
                    {h.honap in szerk && (
                      <button onClick={() => celMentes(h.honap)} className="ml-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs">
                        Mentés
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="h-3 w-full rounded-full bg-black/5" title={cel ? `${Math.round((varhato / cel) * 100)}% a célhoz` : "Nincs cél"}>
                      <div className="h-3 rounded-full bg-[var(--primary)]" style={{ width: `${Math.min(100, (varhato / max) * 100)}%` }} />
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">{cel ? `${Math.round((varhato / cel) * 100)}% a célhoz` : "nincs cél"}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
          Dátum nélküli vagy már lejárt várható lezárású nyitott érdeklődők súlyozott értéke: {forint(adat.datum_nelkul_sulyozott)}.
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          <h2 className="px-3 pt-3 text-sm font-semibold">Teljesítmény felelősönként</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="px-3 py-2">Felelős</th>
                <th className="px-3 py-2">Nyert (db)</th>
                <th className="px-3 py-2">Nyert érték</th>
                <th className="px-3 py-2">Nyitott súlyozott</th>
              </tr>
            </thead>
            <tbody>
              {adat.teljesitmeny.map((t, i) => (
                <tr key={i} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{t.felelos || "Nincs felelős"}</td>
                  <td className="px-3 py-2">{t.nyert_db}</td>
                  <td className="px-3 py-2">{forint(t.nyert_osszeg)}</td>
                  <td className="px-3 py-2">{forint(t.nyitott_sulyozott)}</td>
                </tr>
              ))}
              {adat.teljesitmeny.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-[var(--muted)]">
                    Még nincs érdeklődő.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="h-fit rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <h2 className="text-sm font-semibold">Szakaszok esélye</h2>
          <p className="mb-2 text-xs text-[var(--muted)]">Ezzel az eséllyel számoljuk a nyitott érdeklődők értékét.</p>
          <ul className="space-y-1 text-sm">
            {Object.entries(adat.valoszinusegek).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{SZAKASZ_LABEL[k] || k}</span>
                <span className="text-[var(--muted)]">{v}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}
