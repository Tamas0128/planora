"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, setTokens } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password);
      setTokens(res.access_token, res.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bejelentkezés sikertelen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--sidebar)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">PLANora</h1>
          <p className="mt-2 text-sm text-gray-500">Építőipari projektütemező</p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Felhasználónév</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Jelszó</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--accent)] py-3 font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? "Bejelentkezés..." : "Bejelentkezés"}
        </button>
      </form>
    </div>
  );
}
