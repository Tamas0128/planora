"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api, ErtesitesItem } from "@/lib/api";

const KULDES_UZENET: Record<string, string> = {
  elkuldve: "Elküldve a címedre.",
  nincs_teendo: "Nincs teendő, nincs mit küldeni.",
  nincs_smtp: "Az e-mail küldés nincs beállítva a szerveren.",
};

export default function NotificationBell() {
  const [items, setItems] = useState<ErtesitesItem[]>([]);
  const [open, setOpen] = useState(false);
  const [emailOn, setEmailOn] = useState(false);
  const [uzenet, setUzenet] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .listErtesitesek()
        .then((r) => alive && setItems(r))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (open) api.getEmailBeallitas().then((b) => setEmailOn(b.email_ertesites)).catch(() => {});
  }, [open]);

  async function toggleEmail(on: boolean) {
    setEmailOn(on);
    try {
      setEmailOn((await api.putEmailBeallitas(on)).email_ertesites);
    } catch {
      setEmailOn(!on);
    }
  }

  async function kuldesMost() {
    setUzenet("");
    try {
      const r = await api.kuldesMostErtesites();
      setUzenet(KULDES_UZENET[r.allapot] || r.allapot);
    } catch (e) {
      setUzenet(e instanceof Error ? e.message : "Hiba");
    }
  }

  return (
    <div className="relative px-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-[var(--radius)] border border-white/10 px-3 py-1.5 text-sm hover:bg-[var(--sidebar-hover)]"
        aria-label="Értesítések"
      >
        <span className="flex items-center gap-2">
          <Bell size={14} /> Értesítések
        </span>
        {items.length > 0 && (
          <span className="rounded-full bg-[var(--danger)] px-1.5 text-xs font-medium text-white" data-testid="ertesites-darab">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 max-h-96 w-full overflow-y-auto md:absolute md:left-4 md:top-full md:z-40 md:w-80 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-lg">
          {items.length === 0 ? (
            <p className="p-3 text-sm text-[var(--muted)]">Nincs teendő — minden rendben.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {items.map((i, n) => (
                <li key={n}>
                  <Link href={i.link} onClick={() => setOpen(false)} className="block px-3 py-2 text-sm hover:bg-black/5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${i.szint === "lejart" ? "bg-[var(--danger)]" : "bg-amber-500"}`} />
                      <span className="font-medium">{i.cim}</span>
                    </div>
                    <div className="pl-4 text-xs text-[var(--muted)]">
                      {i.reszlet}
                      {i.datum ? ` · ${i.datum}` : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1 border-t border-[var(--border)] p-3 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={emailOn} onChange={(e) => toggleEmail(e.target.checked)} />
              Napi összefoglaló e-mailben
            </label>
            <button onClick={kuldesMost} className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1">
              Küldés most
            </button>
            {uzenet && <div className="text-[var(--muted)]">{uzenet}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
