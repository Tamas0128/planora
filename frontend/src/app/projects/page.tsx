"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Calendar,
  ChevronRight,
  Download,
  Image as ImageIcon,
  List,
  MapPin,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { NewProjectDialog } from "@/components/NewProjectDialog";

// Leaflet touches `window` at import time, so it can never render on the
// server — load it only in the browser.
const ProjectsMap = dynamic(() => import("@/components/ProjectsMap"), {
  ssr: false,
  loading: () => <div className="flex h-[560px] items-center justify-center text-xs text-slate-400">Térkép betöltése…</div>,
});
import { api, BUILDING_LABELS, downloadFile, ProjectCard, STATUS_LABELS } from "@/lib/api";
import { clampPercent, DEFAULT_CFG, isLate, pmInitials, STATUS_CFG, STATUS_ORDER } from "@/lib/project-utils";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function ProjectThumbnailPreview({ projectId, hasThumbnail }: { projectId: number; hasThumbnail: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (hasThumbnail) {
      api.thumbnailUrl(projectId).then((r) => setUrl(r.url)).catch(() => setUrl(null));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset, no async step needed
      setUrl(null);
    }
  }, [projectId, hasThumbnail]);

  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static/local asset
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-3.5 text-slate-300" />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showNew, setShowNew]   = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

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

  async function toggleFavorite(e: React.MouseEvent, project: ProjectCard) {
    e.stopPropagation();
    const next = !project.is_favorite;
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, is_favorite: next } : p)));
    try {
      if (next) await api.addFavorite(project.id);
      else await api.removeFavorite(project.id);
    } catch (err) {
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, is_favorite: !next } : p)));
      toast.error(err instanceof Error ? err.message : "Hiba a kedvenc jelölése során");
    }
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id)),
    );
  }

  async function handleGanttExport() {
    setExporting(true);
    try {
      await downloadFile(`/reports/multi-gantt.pdf?ids=${[...selected].join(",")}`, "projektek_gantt.pdf");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a Gantt-diagram létrehozása során");
    } finally {
      setExporting(false);
    }
  }

  const counts = useMemo(
    () => projects.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {}),
    [projects],
  );

  const pageHeader = (
    <header className="sticky top-0 z-20 flex h-auto min-h-12 shrink-0 flex-wrap items-center gap-2.5 border-b border-slate-100 bg-white px-4 py-2">
      <SidebarTrigger className="text-slate-400 hover:text-slate-700" />
      <div className="h-5 w-px bg-slate-100" />
      <h1 className="text-[14px] font-bold tracking-tight text-slate-900">Projektek</h1>
      <div className="flex items-center rounded-lg border border-slate-200 p-0.5">
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium",
            view === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <List className="size-3.5" /> Lista
        </button>
        <button
          type="button"
          onClick={() => setView("map")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium",
            view === "map" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <MapPin className="size-3.5" /> Térkép
        </button>
      </div>
      <div className="hidden flex-1 sm:block" />
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Keresés…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-32 rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none sm:w-56"
        />
      </div>
      {selected.size > 0 && (
        <Button
          size="sm"
          variant="outline"
          disabled={exporting}
          onClick={handleGanttExport}
          className="h-8 gap-1.5 text-[13px] font-semibold"
        >
          <Download className="size-3.5" />
          {exporting ? "Készül…" : `Gantt PDF (${selected.size})`}
        </Button>
      )}
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

      {view === "map" ? (
        <ProjectsMap projects={filtered} />
      ) : (
      <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="w-8 px-3 py-1.5">
                <input
                  type="checkbox"
                  aria-label="Összes kijelölése"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="size-3.5 cursor-pointer accent-blue-600"
                />
              </th>
              <th className="w-8" />
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
                <td colSpan={9} className="px-3 py-10 text-center text-xs text-slate-400">Betöltés…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-xs text-slate-400">
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
                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`${p.name} kijelölése`}
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="size-3.5 cursor-pointer accent-blue-600"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      aria-label={p.is_favorite ? "Kedvenc eltávolítása" : "Kedvencnek jelölés"}
                      onClick={(e) => toggleFavorite(e, p)}
                      className="text-slate-300 hover:text-amber-400"
                    >
                      <Star className={cn("size-4", p.is_favorite && "fill-amber-400 text-amber-400")} />
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.badge)}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2.5">
                      <ProjectThumbnailPreview projectId={p.id} hasThumbnail={p.has_thumbnail} />
                      <div>
                        <p className="text-[12px] font-semibold text-slate-900">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.project_code}</p>
                      </div>
                    </div>
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
      )}

      <NewProjectDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(id) => router.push(`/projects/${id}`)}
      />
    </AppLayout>
  );
}
