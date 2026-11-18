"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Alvallalkozo, Munkanem, Szemely, api } from "@/lib/api";

export default function TorzsadatokPage() {
  const [tab, setTab] = useState<"munkanem" | "alvallalkozo" | "szemely">("munkanem");

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">Törzsadatok</h1>
      <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
        {(
          [
            ["munkanem", "Munkanemek"],
            ["alvallalkozo", "Alvállalkozók"],
            ["szemely", "Személyek"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === v ? "border-b-2 border-[var(--primary)] text-[var(--primary)]" : "text-[var(--muted)]"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "munkanem" && <MunkanemekTab />}
      {tab === "alvallalkozo" && <AlvallalkozokTab />}
      {tab === "szemely" && <SzemelyekTab />}
    </AppLayout>
  );
}

const CSOPORT_LABEL: Record<string, string> = {
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

  return (
    <div className="max-w-xl">
      <p className="mb-2 text-sm text-[var(--muted)]">
        Kiinduló munkanem-törzs — a teljes katalógus bővítése külön lépésben történik.
      </p>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {items.map((m) => (
          <li key={m.id} className="flex justify-between px-3 py-2 text-sm">
            <span>{m.nev}</span>
            <span className="text-[var(--muted)]">{CSOPORT_LABEL[m.csoport] || m.csoport}</span>
          </li>
        ))}
      </ul>
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
            <span>{a.nev}</span>
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
            <span>{s.nev}</span>
            <span className="text-[var(--muted)]">{s.szervezet === "belso" ? "Belső" : "Külső"}</span>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-4 text-center text-sm text-[var(--muted)]">Nincs még személy.</li>}
      </ul>
    </div>
  );
}
