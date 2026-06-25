"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Activity,
  api,
  BUILDING_LABELS,
  ProjectDetail,
  STATUS_LABELS,
} from "@/lib/api";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tab, setTab] = useState<"info" | "schedule">("info");

  useEffect(() => {
    if (!id) return;
    api.project(id).then(setProject).catch(console.error);
    api.activities(id).then(setActivities).catch(console.error);
  }, [id]);

  async function updateStatus(activityId: number, status: string) {
    await api.updateActivity(id, activityId, { status });
    const updated = await api.activities(id);
    setActivities(updated);
    const p = await api.project(id);
    setProject(p);
  }

  if (!project) {
    return (
      <AppLayout>
        <p className="text-gray-500">Betöltés...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-gray-500">
          {project.project_code} · {project.settlement}
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(["info", "schedule"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-indigo-600 text-white" : "bg-white text-gray-600 shadow-sm"
            }`}
          >
            {t === "info" ? "Adatlap" : "Ütemterv"}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">Projekt adatok</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Státusz</dt><dd>{STATUS_LABELS[project.status]}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Cím</dt><dd>{project.address}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Épülettípus</dt><dd>{BUILDING_LABELS[project.building_type]}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Alapterület</dt><dd>{project.floor_area_sqm} m²</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Átadás</dt><dd>{new Date(project.delivery_date).toLocaleDateString("hu-HU")}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Készültség</dt><dd>{project.completion_percent}%</dd></div>
            </dl>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold">Ügyfél</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Név</dt><dd>{project.client_name}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Telefon</dt><dd>{project.client_phone || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">E-mail</dt><dd>{project.client_email || "—"}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Tevékenység</th>
                <th className="px-4 py-3">Nap</th>
                <th className="px-4 py-3">Előkészítés</th>
                <th className="px-4 py-3">Kezdés</th>
                <th className="px-4 py-3">Befejezés</th>
                <th className="px-4 py-3">Státusz</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3">{a.duration_days}</td>
                  <td className="px-4 py-3">
                    {a.prep_date ? new Date(a.prep_date).toLocaleDateString("hu-HU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.start_date ? new Date(a.start_date).toLocaleDateString("hu-HU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.end_date ? new Date(a.end_date).toLocaleDateString("hu-HU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={a.status}
                      onChange={(e) => updateStatus(a.id, e.target.value)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      <option value="pending">Várakozik</option>
                      <option value="in_progress">Folyamatban</option>
                      <option value="done">Kész</option>
                      <option value="blocked">Blokkolt</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
