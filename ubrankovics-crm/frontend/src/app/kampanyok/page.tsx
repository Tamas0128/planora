"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { api, Cimke, Kampany, Ugyfel } from "@/lib/api";

const inputCls = "w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";

export default function KampanyokPage() {
  const [cimkek, setCimkek] = useState<Cimke[]>([]);
  const [kampanyok, setKampanyok] = useState<Kampany[]>([]);
  const [cimkeId, setCimkeId] = useState("");
  const [cimzettek, setCimzettek] = useState<number | null>(null);
  const [leiratkozott, setLeiratkozott] = useState(0);
  const [szegmens, setSzegmens] = useState<Ugyfel[]>([]);
  const [nev, setNev] = useState("");
  const [targy, setTargy] = useState("");
  const [uzenet, setUzenet] = useState("");
  const [uj, setUj] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function load() {
    api.listCimkek().then(setCimkek).catch((e) => setError(e.message));
    api.listKampanyok().then(setKampanyok).catch(() => {});
  }

  useEffect(load, []);

  useEffect(() => {
    const id = cimkeId ? Number(cimkeId) : null;
    api
      .getKampanyCimzettek(id)
      .then((r) => {
        setCimzettek(r.darab);
        setLeiratkozott(r.leiratkozott);
      })
      .catch(() => setCimzettek(null));
    if (id) api.listSzegmensUgyfelek(id).then(setSzegmens).catch(() => setSzegmens([]));
  }, [cimkeId]);

  async function ujCimke(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createCimke(uj.trim());
      setUj("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function cimkeTorles(c: Cimke) {
    if (!confirm(`Törlöd a(z) "${c.nev}" címkét? Az ügyfelek megmaradnak.`)) return;
    await api.deleteCimke(c.id);
    if (cimkeId === String(c.id)) setCimkeId("");
    load();
  }

  async function kuldes(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!confirm(`${cimzettek ?? 0} címzettnek elküldöd a levelet?`)) return;
    try {
      const k = await api.sendKampany({ nev, targy, uzenet, cimke_id: cimkeId ? Number(cimkeId) : null });
      setInfo(
        k.elkuldve_szama === k.cimzettek_szama
          ? `Elküldve ${k.elkuldve_szama} címzettnek.`
          : `${k.elkuldve_szama}/${k.cimzettek_szama} levél ment ki (a többi nem sikerült, vagy nincs SMTP beállítva).`
      );
      setNev("");
      setTargy("");
      setUzenet("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">Szegmensek és kampányok</h1>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      {info && <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">{info}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="h-fit space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-sm font-semibold">Címkék (szegmensek)</h2>
          <ul className="divide-y divide-[var(--border)] text-sm">
            {cimkek.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-1.5">
                <span>
                  {c.nev} <span className="text-[var(--muted)]">({c.ugyfel_szam})</span>
                </span>
                <button onClick={() => cimkeTorles(c)} className="text-xs text-[var(--danger)]">
                  Törlés
                </button>
              </li>
            ))}
            {cimkek.length === 0 && <li className="py-2 text-[var(--muted)]">Még nincs címke. Az ügyfélkártyán is felvehetsz.</li>}
          </ul>
          <form onSubmit={ujCimke} className="flex gap-2">
            <input required placeholder="Új címke" value={uj} onChange={(e) => setUj(e.target.value)} className={inputCls} />
            <button type="submit" className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm">
              Létrehoz
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <form onSubmit={kuldes} className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold">Új kampány (e-mail)</h2>
            <select value={cimkeId} onChange={(e) => setCimkeId(e.target.value)} className={inputCls} aria-label="Címzettek">
              <option value="">Minden e-mail címmel rendelkező ügyfél</option>
              {cimkek.map((c) => (
                <option key={c.id} value={c.id}>
                  Szegmens: {c.nev}
                </option>
              ))}
            </select>
            <div className="text-xs text-[var(--muted)]" data-testid="cimzettek-szama">
              Címzettek (e-mail címmel): {cimzettek ?? "—"}
              {leiratkozott > 0 && ` (+${leiratkozott} leiratkozott, kihagyva)`}
              {cimkeId && szegmens.length > 0 && (
                <>
                  {" · "}
                  {szegmens.map((u, i) => (
                    <span key={u.id}>
                      {i > 0 && ", "}
                      <Link href={`/ugyfelek/${u.id}`} className="hover:underline">
                        {u.nev}
                      </Link>
                    </span>
                  ))}
                </>
              )}
            </div>
            <input required placeholder="Kampány neve (belső)" value={nev} onChange={(e) => setNev(e.target.value)} className={inputCls} />
            <input required placeholder="E-mail tárgya" value={targy} onChange={(e) => setTargy(e.target.value)} className={inputCls} />
            <textarea required placeholder="Üzenet" rows={5} value={uzenet} onChange={(e) => setUzenet(e.target.value)} className={inputCls} />
            <button
              type="submit"
              disabled={!cimzettek}
              className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              Küldés
            </button>
          </form>

          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left">
                <tr>
                  <th className="px-3 py-2">Kampány</th>
                  <th className="px-3 py-2">Szegmens</th>
                  <th className="px-3 py-2">Elküldve</th>
                  <th className="px-3 py-2">Mikor</th>
                </tr>
              </thead>
              <tbody>
                {kampanyok.map((k) => (
                  <tr key={k.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <div className="font-medium">{k.nev}</div>
                      <div className="text-xs text-[var(--muted)]">{k.targy}</div>
                    </td>
                    <td className="px-3 py-2">{k.cimke_nev || "Mindenki"}</td>
                    <td className="px-3 py-2">
                      {k.elkuldve_szama}/{k.cimzettek_szama}
                    </td>
                    <td className="px-3 py-2">{new Date(k.created_at).toLocaleString("hu-HU")}</td>
                  </tr>
                ))}
                {kampanyok.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                      Még nem ment ki kampány.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
