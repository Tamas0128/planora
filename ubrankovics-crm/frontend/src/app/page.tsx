"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import {
  CashflowRolling,
  Feladat,
  PenzugyiOsszesito,
  ProjektListItem,
  UserResponse,
  api,
} from "@/lib/api";

const cardCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]";

const ALLAPOT_LABEL: Record<string, string> = {
  uj: "Új",
  ajanlat: "Ajánlat",
  szerzodott: "Szerződött",
  kivitelezes: "Kivitelezés",
  lezart: "Lezárt",
};

function huf(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toLocaleString("hu-HU")} Ft`;
}

function isOverdue(hatarido: string | null | undefined): boolean {
  if (!hatarido) return false;
  return new Date(hatarido) < new Date(new Date().toDateString());
}

export default function DashboardPage() {
  const [me, setMe] = useState<UserResponse | null>(null);
  const [projektek, setProjektek] = useState<ProjektListItem[] | null>(null);
  const [feladatok, setFeladatok] = useState<Feladat[] | null>(null);
  const [osszesito, setOsszesito] = useState<PenzugyiOsszesito | null>(null);
  const [cashflow, setCashflow] = useState<CashflowRolling | null>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.listProjektek().then(setProjektek).catch(() => {});
    api.listFeladatok({ kesz: false }).then(setFeladatok).catch(() => {});
    api.getPenzugyiOsszesito().then(setOsszesito).catch(() => {});
    api.getRollingCashflow({ bucket: "het", horizon: 1 }).then(setCashflow).catch(() => {});
  }, []);

  const projektMegoszlas = useMemo(() => {
    if (!projektek) return null;
    const map = new Map<string, number>();
    for (const p of projektek) map.set(p.allapot, (map.get(p.allapot) || 0) + 1);
    return map;
  }, [projektek]);

  const sajatFeladatok = useMemo(() => {
    if (!feladatok || !me) return [];
    return feladatok
      .filter((f) => f.felelos_id === me.id)
      .sort((a, b) => (a.hatarido || "9999").localeCompare(b.hatarido || "9999"))
      .slice(0, 5);
  }, [feladatok, me]);

  const aktivBucket = cashflow?.bucketek[0];

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">Kezdőlap{me ? ` — ${me.full_name}` : ""}</h1>

      {aktivBucket?.negativ && (
        <div className="mb-4 rounded-[var(--radius)] border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Likviditási kockázat: a folyó hét záró egyenlege negatívra fordul ({huf(aktivBucket.zaro)}).
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${cardCls} p-3`}>
          <div className="text-xs text-[var(--muted)]">Projektek összesen</div>
          <div className="text-2xl font-semibold">{projektek ? projektek.length : "—"}</div>
        </div>
        <div className={`${cardCls} p-3`}>
          <div className="text-xs text-[var(--muted)]">Nyitott saját feladat</div>
          <div className="text-2xl font-semibold">{sajatFeladatok.length}</div>
        </div>
        <div className={`${cardCls} p-3`}>
          <div className="text-xs text-[var(--muted)]">Lejárt bevétel (hátralék)</div>
          <div className="text-xl font-semibold text-emerald-700">{osszesito ? huf(osszesito.lejart_bevetel_osszesen) : "—"}</div>
        </div>
        <div className={`${cardCls} p-3`}>
          <div className="text-xs text-[var(--muted)]">Lejárt kiadás (hátralék)</div>
          <div className="text-xl font-semibold text-red-700">{osszesito ? huf(osszesito.lejart_kiadas_osszesen) : "—"}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className={`${cardCls} p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Projektek állapot szerint</h2>
            <Link href="/projektek" className="text-xs text-[var(--primary)] hover:underline">
              Mind megnyitása
            </Link>
          </div>
          {!projektMegoszlas ? (
            <p className="text-sm text-[var(--muted)]">Betöltés…</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(ALLAPOT_LABEL).map(([v, l]) => (
                <li key={v} className="flex justify-between">
                  <span>{l}</span>
                  <span className="text-[var(--muted)]">{projektMegoszlas.get(v) || 0}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${cardCls} p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Közelgő saját feladatok</h2>
            <Link href="/feladatok" className="text-xs text-[var(--primary)] hover:underline">
              Mind megnyitása
            </Link>
          </div>
          {!feladatok ? (
            <p className="text-sm text-[var(--muted)]">Betöltés…</p>
          ) : sajatFeladatok.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nincs nyitott saját feladat.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {sajatFeladatok.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-1.5">
                  <span>{f.cim}</span>
                  {f.hatarido && (
                    <span className={isOverdue(f.hatarido) ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}>
                      {f.hatarido}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href="/riportok" className="text-[var(--primary)] hover:underline">
          Teljes riportok →
        </Link>
        <span className="text-[var(--muted)]">·</span>
        <Link href="/penzugy" className="text-[var(--primary)] hover:underline">
          Cash flow előrejelzés →
        </Link>
      </div>
    </AppLayout>
  );
}
