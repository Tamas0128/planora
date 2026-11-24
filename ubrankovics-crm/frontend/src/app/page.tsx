"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { ALLAPOT_LABEL, ALLAPOT_SZIN } from "@/components/AllapotPill";
import RadialAllapotDiagram from "@/components/RadialAllapotDiagram";
import {
  CashflowRolling,
  Feladat,
  PenzugyiOsszesito,
  ProjektListItem,
  UserResponse,
  api,
} from "@/lib/api";

const cardCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]";

function huf(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toLocaleString("hu-HU")} Ft`;
}

function isOverdue(hatarido: string | null | undefined): boolean {
  if (!hatarido) return false;
  return new Date(hatarido) < new Date(new Date().toDateString());
}

function LejartKartya({ cimke, osszeg }: { cimke: string; osszeg: string | undefined }) {
  const van = osszeg !== undefined && Number(osszeg) > 0;
  return (
    <Link
      href="/riportok"
      className={`block rounded-[var(--radius)] border p-4 hover:border-[var(--primary)] ${
        van ? "border-[var(--danger)]/40 bg-[var(--danger-bg)]" : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
        {van && <AlertTriangle size={13} className="text-[var(--danger)]" aria-hidden="true" />}
        {cimke}
      </div>
      <div className={`font-heading text-3xl font-bold leading-tight tabular-nums ${van ? "text-[var(--danger)]" : "text-[var(--positive)]"}`}>
        {osszeg === undefined ? "—" : van ? huf(osszeg) : "Nincs lejárt"}
      </div>
    </Link>
  );
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

  const sajatOsszes = useMemo(() => {
    if (!feladatok || !me) return null;
    return feladatok
      .filter((f) => f.felelos_id === me.id)
      .sort((a, b) => (a.hatarido || "9999").localeCompare(b.hatarido || "9999"));
  }, [feladatok, me]);
  const sajatFeladatok = useMemo(() => (sajatOsszes ?? []).slice(0, 5), [sajatOsszes]);

  const aktivBucket = cashflow?.bucketek[0];

  return (
    <AppLayout>
      <h1 className="text-xl font-semibold">Kezdőlap{me ? ` — ${me.full_name}` : ""}</h1>

      {aktivBucket?.negativ && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          Likviditási kockázat: a folyó hét záró egyenlege negatívra fordul ({huf(aktivBucket.zaro)}).
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-[var(--muted)]">Projektek összesen</div>
          <div className="font-heading text-4xl font-bold leading-tight">{projektek ? projektek.length : "—"}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-[var(--muted)]">Nyitott saját feladat</div>
          <div className="font-heading text-4xl font-bold leading-tight">{sajatOsszes ? sajatOsszes.length : "—"}</div>
        </div>
        <LejartKartya cimke="Lejárt bevétel (ügyfelek tartoznak)" osszeg={osszesito?.lejart_bevetel_osszesen} />
        <LejartKartya cimke="Lejárt kiadás (mi tartozunk)" osszeg={osszesito?.lejart_kiadas_osszesen} />
      </div>

      {osszesito && osszesito.lejart_szamlak.length > 0 && (
        <div className={`${cardCls} mt-4 p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--danger)]">
              <AlertTriangle size={16} aria-hidden="true" /> Lejárt számlák ({osszesito.lejart_szamlak.length})
            </h2>
            <Link href="/riportok" className="inline-flex min-h-11 items-center text-xs text-[var(--primary)] hover:underline md:min-h-0">
              Mind a riportokban
            </Link>
          </div>
          <ul className="divide-y divide-[var(--border)] text-sm">
            {[...osszesito.lejart_szamlak]
              .sort((a, b) => Number(b.hatralek) - Number(a.hatralek))
              .slice(0, 3)
              .map((s) => (
                <li key={`${s.forras_tipus}-${s.forras_id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                  <span>
                    <span className="font-medium">{s.szamlaszam}</span>
                    <span className="text-[var(--muted)]"> — {s.partner_nev} · </span>
                    <Link href={`/projektek/${s.projekt_id}`} className="text-[var(--primary)] hover:underline">
                      {s.projekt_nev}
                    </Link>
                    <span className="block text-xs text-[var(--muted)]">
                      {s.forras_tipus === "ugyfel_szamla" ? "Bevétel" : "Kiadás"} · esedékes: {s.esedekesseg}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--danger)]">{huf(s.hatralek)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className={`${cardCls} p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Projektek állapot szerint</h2>
            <Link href="/projektek" className="inline-flex min-h-11 items-center text-xs text-[var(--primary)] hover:underline md:min-h-0">
              Mind megnyitása
            </Link>
          </div>
          {!projektMegoszlas ? (
            <p className="text-sm text-[var(--muted)]">Betöltés…</p>
          ) : (
            <RadialAllapotDiagram
              osszes={projektek?.length || 0}
              sorok={Object.entries(ALLAPOT_LABEL).map(([v, l]) => ({
                kulcs: v,
                cimke: l,
                ertek: projektMegoszlas.get(v) || 0,
                szin: ALLAPOT_SZIN[v],
              }))}
            />
          )}
        </div>

        <div className={`${cardCls} p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Közelgő saját feladatok</h2>
            <Link href="/feladatok" className="inline-flex min-h-11 items-center text-xs text-[var(--primary)] hover:underline md:min-h-0">
              Mind megnyitása
            </Link>
          </div>
          {!sajatOsszes ? (
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
        <Link href="/riportok" className="inline-flex min-h-11 items-center text-[var(--primary)] hover:underline md:min-h-0">
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
