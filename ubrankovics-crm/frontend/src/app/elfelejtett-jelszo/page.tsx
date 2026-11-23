"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function ElfelejtettJelszoPage() {
  const [azonosito, setAzonosito] = useState("");
  const [kesz, setKesz] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await api.elfelejtettJelszo(azonosito);
      setKesz(r.uzenet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--foreground)] p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[var(--radius)] bg-[var(--card)] p-6 shadow-xl">
        <h1 className="text-lg font-semibold">Elfelejtett jelszó</h1>
        {kesz ? (
          <p role="status" className="text-sm" data-testid="reset-kerve">{kesz}</p>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">Add meg a felhasználóneved vagy az e-mail címed, és küldünk egy linket az új jelszó megadásához.</p>
            {error && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
            <div className="space-y-1">
              <label htmlFor="fj-az" className="text-sm font-medium">Felhasználónév vagy e-mail</label>
              <input id="fj-az" required className="w-full rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm" value={azonosito} onChange={(e) => setAzonosito(e.target.value)} />
            </div>
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Link kérése
            </button>
          </>
        )}
        <p className="text-center text-sm">
          <Link href="/login" className="text-[var(--primary)] hover:underline">Vissza a belépéshez</Link>
        </p>
      </form>
    </div>
  );
}
