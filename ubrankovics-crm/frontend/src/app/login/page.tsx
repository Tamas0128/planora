"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, setTokens } from "@/lib/api";

const INPUT = "w-full rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm";

function hibaSzoveg(msg: string): string {
  return msg === "Invalid credentials" ? "Hibás felhasználónév vagy jelszó." : msg;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpKell, setOtpKell] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password, otpKell ? otp : undefined);
      setTokens(res.access_token, res.refresh_token);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bejelentkezés sikertelen";
      if (msg === "otp_required") setOtpKell(true);
      else setError(hibaSzoveg(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--foreground)] p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-[var(--radius)] bg-[var(--card)] p-6 shadow-xl"
      >
        <h1 className="sr-only">Ubrankovics CRM – bejelentkezés</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ubrankovics-logo.svg" alt="Ubrankovics" className="mx-auto w-48" />
        {error && (
          <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>
        )}
        <div className="space-y-1">
          <label htmlFor="login-user" className="text-sm font-medium">Felhasználónév</label>
          <input id="login-user" autoComplete="username" className={INPUT} value={username} onChange={(e) => setUsername(e.target.value)} disabled={otpKell} />
        </div>
        <div className="space-y-1">
          <label htmlFor="login-pass" className="text-sm font-medium">Jelszó</label>
          <input id="login-pass" type="password" autoComplete="current-password" className={INPUT} value={password} onChange={(e) => setPassword(e.target.value)} disabled={otpKell} />
        </div>
        {otpKell && (
          <div className="space-y-1">
            <label htmlFor="login-otp" className="text-sm font-medium">Hitelesítő kód (6 számjegy)</label>
            <input id="login-otp" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} className={INPUT} value={otp} onChange={(e) => setOtp(e.target.value)} />
            <p className="text-xs text-[var(--muted)]">Add meg a hitelesítő alkalmazásban látható aktuális kódot.</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {otpKell ? "Belépés a kóddal" : "Bejelentkezés"}
        </button>
        <p className="text-center text-sm">
          <Link href="/elfelejtett-jelszo" className="text-[var(--primary)] underline-offset-2 hover:underline">
            Elfelejtettem a jelszavam
          </Link>
        </p>
      </form>
    </div>
  );
}
