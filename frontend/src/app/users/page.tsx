"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, User } from "@/lib/api";

const ROLE_OPTIONS: [string, string][] = [
  ["admin", "Admin"],
  ["project_manager", "Projektmenedzser"],
  ["management", "Menedzsment"],
  ["procurement", "Beszerzés"],
  ["billing", "Számlázás"],
];

export default function UsersPage() {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    role: "project_manager",
  });

  function load() {
    api.users().then(setUsers).catch(console.error);
  }

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createUser(form);
      setShowNew(false);
      setForm({ username: "", email: "", full_name: "", password: "", role: "project_manager" });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: User) {
    await api.updateUser(user.id, { is_active: !user.is_active });
    load();
  }

  async function changeRole(user: User, role: string) {
    await api.updateUser(user.id, { role });
    load();
  }

  if (me && me.role !== "admin") {
    return (
      <AppLayout>
        <p className="text-gray-500">Nincs jogosultságod ehhez a felülethez.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Felhasználók</h1>
          <p className="text-gray-500">Felhasználói fiókok és szerepkörök kezelése</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
        >
          + Új felhasználó
        </button>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={createUser} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold">Új felhasználó</h2>
            <label className="mb-3 block">
              <span className="text-sm text-gray-600">Felhasználónév</span>
              <input
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label className="mb-3 block">
              <span className="text-sm text-gray-600">Teljes név</span>
              <input
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </label>
            <label className="mb-3 block">
              <span className="text-sm text-gray-600">E-mail</span>
              <input
                type="email"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="mb-3 block">
              <span className="text-sm text-gray-600">Jelszó</span>
              <input
                type="password"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label className="mb-4 block">
              <span className="text-sm text-gray-600">Szerepkör</span>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {creating ? "Mentés..." : "Létrehozás"}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border px-4 py-2">
                Mégse
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3">Felhasználónév</th>
              <th className="px-4 py-3">Teljes név</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Szerepkör</th>
              <th className="px-4 py-3">Állapot</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{user.username}</td>
                <td className="px-4 py-3">{user.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user, e.target.value)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {user.is_active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Aktív</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inaktív</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive(user)} className="text-indigo-600 hover:underline">
                    {user.is_active ? "Letiltás" : "Aktiválás"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nincs felhasználó
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
