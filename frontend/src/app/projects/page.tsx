"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import {
  api,
  BUILDING_LABELS,
  ProjectCard,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/api";

function ProjectCardComponent({ project }: { project: ProjectCard }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <h3 className="font-semibold text-gray-900">{project.name}</h3>
      <p className="mt-1 text-sm text-gray-500">{project.settlement}</p>
      <div className="mt-3 space-y-1 text-xs text-gray-600">
        <p>Ügyfél: {project.client_name}</p>
        <p>Típus: {BUILDING_LABELS[project.building_type] || project.building_type}</p>
        <p>{project.floor_area_sqm} m²</p>
        {project.project_manager_name && <p>PM: {project.project_manager_name}</p>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Átadás: {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
        </span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
          {project.completion_percent}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${project.completion_percent}%` }}
        />
      </div>
    </Link>
  );
}

const COLUMN_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"];

export default function ProjectsPage() {
  const [board, setBoard] = useState<Record<string, ProjectCard[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    project_code: "",
    settlement: "",
    address: "",
    client_name: "",
    floor_area_sqm: 145,
    delivery_date: "2026-09-18",
    building_type: "light_steel",
  });

  function load() {
    api.kanban().then(setBoard).catch(console.error);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createProject(form);
      setShowNew(false);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projektek</h1>
          <p className="text-gray-500">Kanban board — projekt státuszok</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
        >
          + Új projekt
        </button>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={createProject} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold">Új projekt</h2>
            {[
              ["name", "Projekt neve"],
              ["project_code", "Projekt azonosító"],
              ["settlement", "Település"],
              ["address", "Cím"],
              ["client_name", "Ügyfél neve"],
            ].map(([key, label]) => (
              <label key={key} className="mb-3 block">
                <span className="text-sm text-gray-600">{label}</span>
                <input
                  required
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="mb-3 block">
              <span className="text-sm text-gray-600">Alapterület (m²)</span>
              <input
                type="number"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.floor_area_sqm}
                onChange={(e) => setForm({ ...form, floor_area_sqm: Number(e.target.value) })}
              />
            </label>
            <label className="mb-3 block">
              <span className="text-sm text-gray-600">Átadási határidő</span>
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-white">
                Létrehozás
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border px-4 py-2">
                Mégse
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => (
          <div key={status} className="min-w-[280px] flex-1">
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold text-white ${STATUS_COLORS[status]}`}>
              {STATUS_LABELS[status]}
              <span className="ml-2 opacity-70">({(board[status] || []).length})</span>
            </div>
            <div className="space-y-3">
              {(board[status] || []).map((p) => (
                <ProjectCardComponent key={p.id} project={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
