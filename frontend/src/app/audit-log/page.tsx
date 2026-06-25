"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, AuditLogEntry, ProjectCard, User } from "@/lib/api";

export default function AuditLogPage() {
  const [me, setMe] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    api.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    api
      .auditLogs(projectId ? Number(projectId) : undefined)
      .then(setLogs)
      .catch(console.error);
  }, [projectId]);

  if (me && me.role !== "admin" && me.role !== "management") {
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
          <h1 className="text-2xl font-bold">Audit napló</h1>
          <p className="text-gray-500">Módosítások nyomon követése</p>
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Összes projekt</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3">Időpont</th>
              <th className="px-4 py-3">Felhasználó</th>
              <th className="px-4 py-3">Projekt</th>
              <th className="px-4 py-3">Entitás</th>
              <th className="px-4 py-3">Mező</th>
              <th className="px-4 py-3">Régi érték</th>
              <th className="px-4 py-3">Új érték</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {new Date(log.created_at).toLocaleString("hu-HU")}
                </td>
                <td className="px-4 py-3">{log.user_name || `#${log.user_id}`}</td>
                <td className="px-4 py-3">{log.project_name || "—"}</td>
                <td className="px-4 py-3 text-gray-500">{log.entity_type}</td>
                <td className="px-4 py-3 font-medium">{log.field_name}</td>
                <td className="px-4 py-3 text-gray-500">{log.old_value || "—"}</td>
                <td className="px-4 py-3">{log.new_value || "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nincs naplóbejegyzés
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
