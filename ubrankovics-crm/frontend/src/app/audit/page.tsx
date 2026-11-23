"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, AuditNaploItem } from "@/lib/api";

const ENTITASOK = ["", "ugyfel", "erdeklodes", "jegy", "kampany", "cimke", "egyedi_mezo", "cel"];

export default function AuditPage() {
  const [lista, setLista] = useState<AuditNaploItem[]>([]);
  const [entitas, setEntitas] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.listAudit(entitas || undefined).then(setLista).catch((e) => setError(e.message));
  }, [entitas]);

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Auditnapló</h1>
        <select
          value={entitas}
          onChange={(e) => setEntitas(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          aria-label="Entitás szűrő"
        >
          {ENTITASOK.map((e) => (
            <option key={e} value={e}>
              {e || "Minden entitás"}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Időpont</th>
              <th className="px-3 py-2">Felhasználó</th>
              <th className="px-3 py-2">Entitás</th>
              <th className="px-3 py-2">Művelet</th>
              <th className="px-3 py-2">Részletek</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((n) => (
              <tr key={n.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(n.created_at).toLocaleString("hu-HU")}</td>
                <td className="px-3 py-2">{n.user?.full_name || "—"}</td>
                <td className="px-3 py-2">
                  {n.entitas}
                  {n.entitas_id != null ? ` #${n.entitas_id}` : ""}
                </td>
                <td className="px-3 py-2">{n.muvelet}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{n.reszletek || ""}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nincs bejegyzés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
