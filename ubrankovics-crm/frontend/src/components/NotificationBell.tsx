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
    <div className="md:relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="relative flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--sidebar-hover)] md:h-9 md:w-9"
        aria-label={items.length > 0 ? `Értesítések, ${items.length} teendő` : "Értesítések"}
      >
        <Bell size={18} />
        {items.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-[var(--danger)] px-1 text-center text-[10px] font-medium leading-4 text-white"
            data-testid="ertesites-darab"
          >
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-14 z-50 max-h-[70dvh] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-1 md:w-80">
          {items.length === 0 ? (
            <p className="p-3 text-sm text-[var(--muted)]">Nincs teendő — minden rendben.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {items.map((i, n) => (
                <li key={n}>
                  <Link href={i.link} onClick={() => setOpen(false)} className="block px-3 py-2 text-sm hover:bg-black/5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${i.szint === "lejart" ? "bg-[var(--danger)]" : "bg-[var(--warning)]"}`} />
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
