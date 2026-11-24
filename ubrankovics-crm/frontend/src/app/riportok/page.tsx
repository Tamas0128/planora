"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { LejartSzamlaItem, PenzugyiOsszesito, SzakaszMegoszlasItem, api } from "@/lib/api";

const cardCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]";

const SZAKASZ_LABEL: Record<string, string> = {
  ajanlat: "Ajánlat",
  szerzodes: "Szerződés",
  beszerzes: "Beszerzés",
  kivitelezes: "Kivitelezés",
  kesz: "Kész",
};

const SZAKASZ_COLOR: Record<string, string> = {
  ajanlat: "#b8a889",
  szerzodes: "#9fb38c",
  beszerzes: "#8ca6b3",
  kivitelezes: "#c9975f",
  kesz: "#7a9b6e",
};

function huf(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toLocaleString("hu-HU")} Ft`;
}

export default function RiportokPage() {
  const [megoszlas, setMegoszlas] = useState<SzakaszMegoszlasItem[] | null>(null);
  const [osszesito, setOsszesito] = useState<PenzugyiOsszesito | null>(null);

  useEffect(() => {
    api.getErtekesitesiAllapot().then(setMegoszlas).catch(() => {});
    api.getPenzugyiOsszesito().then(setOsszesito).catch(() => {});
  }, []);

  const maxErtek = useMemo(
    () => Math.max(1, ...(megoszlas || []).map((m) => Number(m.tetel_szam))),
    [megoszlas]
  );

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">Riportok</h1>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Értékesítési állapot</h2>
        <p className="mb-2 text-xs text-[var(--muted)]">
          Tételek megoszlása szakaszonként: a sáv hossza a tételek számát mutatja, mellette az ügyfélnek kiajánlott érték (bruttó) áll.
        </p>
        {!megoszlas ? (
          <p className="text-sm text-[var(--muted)]">Betöltés…</p>
        ) : (
          <div className={`${cardCls} divide-y divide-[var(--border)] p-3`}>
            {megoszlas.map((m) => (
              <div key={m.szakasz} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-28 shrink-0">{SZAKASZ_LABEL[m.szakasz] || m.szakasz}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(Number(m.tetel_szam) / maxErtek) * 100}%`,
                      backgroundColor: SZAKASZ_COLOR[m.szakasz] || "#999",
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[var(--muted)]">{m.tetel_szam} db</span>
                <span className="w-32 shrink-0 text-right font-medium">{huf(m.ertek_osszesen)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Pénzügyi összesítő</h2>
        {!osszesito ? (
          <p className="text-sm text-[var(--muted)]">Betöltés…</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className={`${cardCls} p-3`}>
                <div className="text-xs text-[var(--muted)]">Lejárt bevétel (hátralék)</div>
                <div className={`text-lg font-semibold tabular-nums ${Number(osszesito.lejart_bevetel_osszesen) > 0 ? "text-[var(--danger)]" : "text-[var(--positive)]"}`}>{huf(osszesito.lejart_bevetel_osszesen)}</div>
              </div>
              <div className={`${cardCls} p-3`}>
                <div className="text-xs text-[var(--muted)]">Lejárt kiadás (hátralék)</div>
                <div className="text-lg font-semibold text-[var(--danger)]">{huf(osszesito.lejart_kiadas_osszesen)}</div>
              </div>
              <div className={`${cardCls} p-3`}>
                <div className="text-xs text-[var(--muted)]">Legutóbbi bankegyenleg</div>
                <div className="text-lg font-semibold">
                  {osszesito.legutobbi_bankegyenleg !== null && osszesito.legutobbi_bankegyenleg !== undefined
                    ? huf(osszesito.legutobbi_bankegyenleg)
                    : "—"}
                </div>
                {osszesito.legutobbi_bankegyenleg_datuma && (
                  <div className="text-xs text-[var(--muted)]">({osszesito.legutobbi_bankegyenleg_datuma})</div>
                )}
              </div>
            </div>

            <div className={`${cardCls} divide-y divide-[var(--border)]`}>
              {osszesito.lejart_szamlak.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                  Nincs lejárt, ki nem fizetett számla.
                </div>
              ) : (
                osszesito.lejart_szamlak.map((item: LejartSzamlaItem) => (
                  <div key={`${item.forras_tipus}-${item.forras_id}`} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{item.szamlaszam}</span>{" "}
                      <span className="text-[var(--muted)]">— {item.partner_nev}</span>
                      <div className="text-xs text-[var(--muted)]">
                        <Link href={`/projektek/${item.projekt_id}`} className="text-[var(--primary)] underline">
                          {item.projekt_nev}
                        </Link>{" "}
                        · esedékes: {item.esedekesseg}
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums text-[var(--danger)]">
                      {huf(item.hatralek)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </AppLayout>
  );
}
