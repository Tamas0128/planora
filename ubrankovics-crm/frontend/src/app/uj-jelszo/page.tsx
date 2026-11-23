"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const INPUT = "w-full rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm";

function UjJelszoForm() {
  const token = useSearchParams().get("token") || "";
  const [jelszo, setJelszo] = useState("");
  const [ismet, setIsmet] = useState("");
  const [kesz, setKesz] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (jelszo !== ismet) {
      setError("A két jelszó nem egyezik.");
      return;
    }
    setLoading(true);
    try {
      await api.ujJelszo(token, jelszo);
      setKesz(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[var(--radius)] bg-[var(--card)] p-6 shadow-xl">
      <h1 className="text-lg font-semibold">Új jelszó megadása</h1>
      {!token ? (
        <p role="alert" className="text-sm text-[var(--danger)]">Hiányzik a visszaállító link kódja. Kérj új linket.</p>
      ) : kesz ? (
        <p role="status" className="text-sm" data-testid="reset-kesz">A jelszó megváltozott. Most már beléphetsz az új jelszóval.</p>
      ) : (
        <>
          {error && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <div className="space-y-1">
            <label htmlFor="uj-jelszo" className="text-sm font-medium">Új jelszó (min. 8 karakter)</label>
            <input id="uj-jelszo" type="password" required minLength={8} autoComplete="new-password" className={INPUT} value={jelszo} onChange={(e) => setJelszo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="uj-jelszo2" className="text-sm font-medium">Jelszó újra</label>
            <input id="uj-jelszo2" type="password" required minLength={8} autoComplete="new-password" className={INPUT} value={ismet} onChange={(e) => setIsmet(e.target.value)} />
          </div>
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Jelszó mentése
          </button>
        </>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="text-[var(--primary)] hover:underline">Vissza a belépéshez</Link>
      </p>
    </form>
  );
}

export default function UjJelszoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--foreground)] p-4">
      <Suspense>
        <UjJelszoForm />
      </Suspense>
    </div>
  );
}
