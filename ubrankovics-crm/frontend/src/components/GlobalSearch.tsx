"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeresesResult, api } from "@/lib/api";

const TIPUS_LABEL: Record<string, string> = {
  ugyfel: "Ügyfelek",
  projekt: "Projektek",
  alvallalkozo: "Alvállalkozók",
  szemely: "Személyek",
};

const TIPUS_PATH: Record<string, string> = {
  ugyfel: "/ugyfelek",
  projekt: "/projektek",
  alvallalkozo: "/alvallalkozok",
  szemely: "/szemelyek",
};

export default function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KeresesResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const handle = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(handle);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    const handle = setTimeout(() => {
      if (!q) {
        setResults([]);
        return;
      }
      api
        .kereses(q)
        .then((r) => {
          setResults(r);
          setActiveIndex(0);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function select(item: KeresesResult) {
    onOpenChange(false);
    router.push(`${TIPUS_PATH[item.tipus]}/${item.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onOpenChange(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      select(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Keresés ügyfél, projekt, alvállalkozó vagy személy szerint…"
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-[var(--muted)]">Nincs találat.</p>
          )}
          {Object.entries(TIPUS_LABEL).map(([tipus, label]) => {
            const items = results.filter((r) => r.tipus === tipus);
            if (items.length === 0) return null;
            return (
              <div key={tipus} className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold uppercase text-[var(--muted)]">{label}</div>
                {items.map((item) => {
                  const idx = results.indexOf(item);
                  return (
                    <button
                      key={`${item.tipus}-${item.id}`}
                      onClick={() => select(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex w-full flex-col items-start rounded-[var(--radius)] px-2 py-1.5 text-left text-sm ${
                        idx === activeIndex ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-black/5"
                      }`}
                    >
                      <span className="font-medium">{item.cim}</span>
                      {item.alcim && <span className="text-xs opacity-70">{item.alcim}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
