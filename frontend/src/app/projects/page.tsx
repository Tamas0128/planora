"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { api, BUILDING_LABELS, ProjectCard, STATUS_LABELS } from "@/lib/api";
import { clampPercent, DEFAULT_CFG, isLate, pmInitials, STATUS_CFG, STATUS_ORDER } from "@/lib/project-utils";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showNew, setShowNew]   = useState(false);

  useEffect(() => {
    api.projects()
      .then(setProjects)
      .catch(() => toast.error("Nem sikerült betölteni a projektek listáját"))
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();

  const filtered = useMemo(
    () => projects.filter((p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.client_name.toLowerCase().includes(q) ||
      p.settlement.toLowerCase().includes(q) ||
      p.project_code.toLowerCase().includes(q),
    ),
    [projects, q],
  );

  const counts = useMemo(
    () => projects.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {}),
    [projects],
  );

  const pageHeader = (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4">
      <SidebarTrigger className="text-slate-400 hover:text-slate-700" />
      <div className="h-5 w-px bg-slate-100" />
      <h1 className="text-[14px] font-bold tracking-tight text-slate-900">Projektek</h1>
      <div className="flex-1" />
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Keresés…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-56 rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
        />
      </div>
      <Button size="sm" onClick={() => setShowNew(true)} className="h-8 gap-1.5 text-[13px] font-semibold">
        <Plus className="size-3.5" /> Új projekt
      </Button>
    </header>
  );

  return (
    <AppLayout header={pageHeader}>
      {/* Stats row — single O(N) pass */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CFG[s];
          return (
            <div key={s} className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-sm">
              <p className="text-[10px] font-medium text-slate-500">{STATUS_LABELS[s]}</p>
              <p className={cn("text-lg font-bold leading-tight", cfg.statText)}>{counts[s] ?? 0}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Státusz</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Projekt</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ügyfél / helyszín</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Projektvezető</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Határidő</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Haladás</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-400">Betöltés…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-400">
                  {search ? "Nincs találat" : "Még nincs projekt"}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const late = isLate(p.delivery_date);
              const cfg = STATUS_CFG[p.status] ?? DEFAULT_CFG;
              const initials = pmInitials(p.project_manager_name);
              const pct = clampPercent(p.completion_percent);
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-3 py-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.badge)}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <p className="text-[12px] font-semibold text-slate-900">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.project_code}</p>
                  </td>
                  <td className="px-3 py-1.5">
                    <p className="text-[12px] text-slate-700">{p.client_name}</p>
                    <p className="text-[10px] text-slate-400">{p.settlement} · {BUILDING_LABELS[p.building_type] ?? p.building_type}</p>
                  </td>
                  <td className="px-3 py-1.5">
                    {p.project_manager_name ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                          {initials}
                        </div>
                        <span className="text-[11px] text-slate-700">{p.project_manager_name}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className={cn("flex items-center gap-1.5 text-[11px]", late ? "text-red-500" : "text-slate-600")}>
                      <Calendar className="size-3 shrink-0" />
                      {new Date(p.delivery_date).toLocaleDateString("hu-HU")}
                      {late && (
                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">Késik</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", cfg.progressBar)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="min-w-[2.5rem] text-right text-[10px] font-medium text-slate-500">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <ChevronRight className="size-4 text-slate-300" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NewProjectDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(id) => router.push(`/projects/${id}`)}
      />
    </AppLayout>
  );
}
