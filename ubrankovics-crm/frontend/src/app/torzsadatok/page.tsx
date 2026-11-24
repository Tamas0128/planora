"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import SablonFajlok from "@/components/SablonFajlok";
import { Alvallalkozo, Munkanem, Szemely, Torzsadat, api } from "@/lib/api";

export default function TorzsadatokPage() {
  const [tab, setTab] = useState<"munkanem" | "torzsadat" | "alvallalkozo" | "szemely" | "sablon">("munkanem");

  // Közvetlen link egy fülre: /torzsadatok?tab=alvallalkozo (kliensen olvassuk, hogy az oldal statikus maradjon).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- az URL csak kliensen olvasható
    if (v === "munkanem" || v === "torzsadat" || v === "alvallalkozo" || v === "szemely" || v === "sablon") setTab(v);
  }, []);

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">Törzsadatok</h1>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {(
          [
            ["munkanem", "Munkanemek"],
            ["torzsadat", "Legördülő listák"],
            ["alvallalkozo", "Alvállalkozók"],
            ["szemely", "Személyek"],
            ["sablon", "Dokumentumsablonok"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === v ? "border-b-2 border-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "munkanem" && <MunkanemekTab />}
      {tab === "torzsadat" && <TorzsadatTab />}
      {tab === "alvallalkozo" && <AlvallalkozokTab />}
      {tab === "szemely" && <SzemelyekTab />}
      {tab === "sablon" && <SablonFajlok />}
    </AppLayout>
  );
}

const CSOPORT_LABEL: Record<string, string> = {
  szerkezet: "Szerkezet",
  alapozas: "Alapozás",
  teto: "Tető",
  nyilaszaro: "Nyílászáró",
  kulso_felulet: "Külső felület",
  gepeszet: "Gépészet",
  aljzat: "Aljzat",
  belso: "Belső",
};

function MunkanemekTab() {
  const [items, setItems] = useState<Munkanem[]>([]);

  useEffect(() => {
    api.listMunkanemek().then(setItems).catch(() => {});
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Munkanem[]>();
    for (const m of items) {
      if (!map.has(m.csoport)) map.set(m.csoport, []);
      map.get(m.csoport)!.push(m);
    }
    return map;
  }, [items]);

  return (
    <div className="max-w-xl">
      <p className="mb-2 text-sm text-[var(--muted)]">
        A munkanemek a projektek tételeinek alapjai: ezekből választhatsz, amikor új tételt veszel fel.
      </p>
      {[...groups.entries()].map(([csoport, list]) => (
        <div key={csoport} className="mb-3">
          <div className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">
            {CSOPORT_LABEL[csoport] || csoport}
          </div>
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
            {list.map((m) => (
              <li key={m.id} className="px-3 py-2 text-sm">
                {m.nev}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TorzsadatTab() {
  const [items, setItems] = useState<Torzsadat[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [ertek, setErtek] = useState("");

  function load() {
    api.listTorzsadatok().then(setItems).catch(() => {});
  }
  useEffect(load, []);

  const tipusok = useMemo(() => [...new Set(items.map((i) => i.tipus))].sort(), [items]);
  const effectiveSelected = selected || tipusok[0] || "";
  const values = useMemo(
    () => items.filter((i) => i.tipus === effectiveSelected),
    [items, effectiveSelected]
  );

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!effectiveSelected || !ertek) return;
    await api.createTorzsadat({ tipus: effectiveSelected, ertek });
    setErtek("");
    load();
  }

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-[18rem_1fr]">
      <div className="max-h-[32rem] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {tipusok.map((t) => (
          <button
            key={t}
            onClick={() => setSelected(t)}
            className={`block w-full border-b border-[var(--border)] px-3 py-2 text-left text-sm last:border-b-0 ${
              t === effectiveSelected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-black/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div>
        <form onSubmit={handleCreate} className="mb-3 flex gap-2">
          <input
            placeholder="Új érték hozzáadása"
            value={ertek}
            onChange={(e) => setErtek(e.target.value)}
            className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={!effectiveSelected}
            className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] disabled:opacity-60"
          >
            <Plus size={14} /> Hozzáad
          </button>
        </form>
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          {values.map((v) => (
            <li key={v.id} className="px-3 py-2 text-sm">
              {v.ertek}
            </li>
          ))}
          {effectiveSelected && values.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Nincs még érték.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function AlvallalkozokTab() {
  const [items, setItems] = useState<Alvallalkozo[]>([]);
  const [nev, setNev] = useState("");
  const [kapcsolat, setKapcsolat] = useState("");

  function load() {
    api.listAlvallalkozok().then(setItems).catch(() => {});
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!nev) return;
    await api.createAlvallalkozo({ nev, kapcsolat: kapcsolat || null });
    setNev("");
    setKapcsolat("");
    load();
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={handleCreate} className="mb-3 flex gap-2">
        <input
          placeholder="Név"
          value={nev}
          onChange={(e) => setNev(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        />
        <input
          placeholder="Kapcsolat"
          value={kapcsolat}
          onChange={(e) => setKapcsolat(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        />
        <button type="submit" className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]">
          <Plus size={14} /> Hozzáad
        </button>
      </form>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {items.map((a) => (
          <li key={a.id} className="flex justify-between px-3 py-2 text-sm">
            <Link href={`/alvallalkozok/${a.id}`} className="text-[var(--primary)] hover:underline">
              {a.nev}
            </Link>
            <span className="text-[var(--muted)]">{a.kapcsolat || "—"}</span>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Nincs még alvállalkozó.</li>}
      </ul>
    </div>
  );
}

function SzemelyekTab() {
  const [items, setItems] = useState<Szemely[]>([]);
  const [nev, setNev] = useState("");
  const [szervezet, setSzervezet] = useState("belso");

  function load() {
    api.listSzemelyek().then(setItems).catch(() => {});
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!nev) return;
    await api.createSzemely({ nev, szervezet });
    setNev("");
    load();
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={handleCreate} className="mb-3 flex gap-2">
        <input
          placeholder="Név"
          value={nev}
          onChange={(e) => setNev(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        />
        <select
          value={szervezet}
          onChange={(e) => setSzervezet(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        >
          <option value="belso">Belső</option>
          <option value="kulso">Külső</option>
        </select>
        <button type="submit" className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]">
          <Plus size={14} /> Hozzáad
        </button>
      </form>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {items.map((s) => (
          <li key={s.id} className="flex justify-between px-3 py-2 text-sm">
            <Link href={`/szemelyek/${s.id}`} className="text-[var(--primary)] hover:underline">
              {s.nev}
            </Link>
            <span className="text-[var(--muted)]">{s.szervezet === "belso" ? "Belső" : "Külső"}</span>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Nincs még személy.</li>}
      </ul>
    </div>
  );
}
