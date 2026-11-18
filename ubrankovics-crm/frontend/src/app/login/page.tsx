"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, setTokens } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password);
      setTokens(res.access_token, res.refresh_token);
      router.push("/ugyfelek");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bejelentkezés sikertelen");
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
        <h1 className="text-center text-lg font-semibold">Ubrankovics CRM</h1>
        {error && (
          <div className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">Felhasználónév</label>
          <input
            className="w-full rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Jelszó</label>
          <input
            type="password"
            className="w-full rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Bejelentkezés
        </button>
      </form>
    </div>
  );
}
