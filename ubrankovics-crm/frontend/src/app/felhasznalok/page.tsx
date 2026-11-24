"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { UserResponse, api } from "@/lib/api";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  ertekesites: "Értékesítés",
  kivitelezes: "Kivitelezés",
  beszerzes: "Beszerzés",
  penzugy: "Pénzügy",
  vezetes: "Vezetés",
};

export default function FelhasznalokPage() {
  const [me, setMe] = useState<UserResponse | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ertekesites");

  function load() {
    api.listUsers().then(setUsers).catch((err) => setError(err instanceof Error ? err.message : "Hiba"));
  }

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    load();
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!username || !email || !fullName || !password) return;
    try {
      await api.createUser({ username, email, full_name: fullName, password, role });
      setUsername("");
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("ertekesites");
      setShowNew(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba a létrehozás során");
    }
  }

  async function changeRole(user: UserResponse, newRole: string) {
    await api.updateUser(user.id, { role: newRole });
    load();
  }

  async function toggleActive(user: UserResponse) {
    await api.updateUser(user.id, { is_active: !user.is_active });
    load();
  }

  async function resetPassword(user: UserResponse) {
    const newPassword = window.prompt(`Új jelszó ${user.full_name} részére:`);
    if (!newPassword) return;
    await api.updateUser(user.id, { password: newPassword });
  }

  if (me && me.role !== "admin") {
    return (
      <AppLayout>
        <p className="text-sm text-[var(--muted)]">Nincs jogosultságod ehhez a felülethez.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Felhasználók</h1>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]"
        >
          <Plus size={14} /> Új felhasználó
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>
      )}

      {showNew && (
        <form onSubmit={createUser} className="mb-4 grid max-w-xl gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
          <input
            placeholder="Felhasználónév"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Teljes név"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <input
            type="password"
            placeholder="Jelszó"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <select aria-label="Szerepkör"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            {Object.entries(ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)]">
            Létrehozás
          </button>
        </form>
      )}

      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Felhasználónév</th>
              <th className="px-3 py-2">Teljes név</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Szerepkör</th>
              <th className="px-3 py-2">Állapot</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-medium">{u.username}</td>
                <td className="px-3 py-2">{u.full_name}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{u.email}</td>
                <td className="px-3 py-2">
                  <select aria-label={`${u.full_name} szerepköre`}
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="rounded border border-[var(--border)] px-1 py-0.5 text-xs"
                  >
                    {Object.entries(ROLE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {u.is_active ? (
                    <span className="rounded-full bg-[var(--color-accent-100)] px-2 py-0.5 text-xs text-[var(--color-accent-700)]">Aktív</span>
                  ) : (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-[var(--muted)]">Inaktív</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => resetPassword(u)} className="mr-3 text-xs text-[var(--primary)] hover:underline">
                    Jelszó visszaállítása
                  </button>
                  <button onClick={() => toggleActive(u)} className="text-xs text-[var(--primary)] hover:underline">
                    {u.is_active ? "Letiltás" : "Aktiválás"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-sm text-[var(--muted)]">
                  Nincs felhasználó.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
