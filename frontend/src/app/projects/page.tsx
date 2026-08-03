"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Calendar,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Kanban as KanbanIcon,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { ProjectsKanbanBoard } from "@/components/ProjectsKanbanBoard";

// Leaflet touches `window` at import time, so it can never render on the
// server — load it only in the browser.
const ProjectsMap = dynamic(() => import("@/components/ProjectsMap"), {
  ssr: false,
  loading: () => <div className="flex h-[560px] items-center justify-center text-xs text-muted-foreground">Térkép betöltése…</div>,
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
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static/local asset
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-3.5 text-muted-foreground/60" />
      )}
    </div>
  );
}

function ProjectBoxThumbnail({ projectId, hasThumbnail }: { projectId: number; hasThumbnail: boolean }) {
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
    <div className="relative h-36 w-full shrink-0 overflow-hidden bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static/local asset
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageIcon className="size-8 text-muted-foreground/60" />
        </div>
      )}
    </div>
  );
}

function ProjectBox({
  project, onClick, onToggleFavorite,
}: {
  project: ProjectCard; onClick: () => void; onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  const late = isLate(project.delivery_date);
  const cfg = STATUS_CFG[project.status] ?? DEFAULT_CFG;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        <ProjectBoxThumbnail projectId={project.id} hasThumbnail={project.has_thumbnail} />
        <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm", cfg.badge)}>
          {STATUS_LABELS[project.status]}
        </span>
        <button
          type="button"
          aria-label={project.is_favorite ? "Kedvenc eltávolítása" : "Kedvencnek jelölés"}
          onClick={onToggleFavorite}
          className="absolute right-2 top-2 rounded-full bg-card/90 p-1.5 text-muted-foreground shadow-sm hover:text-primary"
        >
          <Star className={cn("size-3.5", project.is_favorite && "fill-primary text-primary")} />
        </button>
      </div>
      <div className="p-3">
        <h3 className="truncate text-[14px] font-bold text-foreground">{project.name}</h3>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{project.client_name} · {project.settlement}</p>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="size-3 shrink-0" />
            {project.floor_area_sqm} m²
          </span>
          <span className={cn("flex items-center gap-1", late && "font-semibold text-destructive")}>
            <Calendar className="size-3 shrink-0" />
            {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
          </span>
        </div>
      </div>
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
  const [view, setView] = useState<"list" | "cards" | "map" | "kanban">("cards");
  const [kanbanBoard, setKanbanBoard] = useState<Record<string, ProjectCard[]>>({});
  const [kanbanLoading, setKanbanLoading] = useState(true);

  function loadProjects() {
    return api.projects()
      .then(setProjects)
      .catch(() => toast.error("Nem sikerült betölteni a projektek listáját"))
      .finally(() => setLoading(false));
  }

  function loadKanban() {
    return api.kanban()
      .then(setKanbanBoard)
      .catch(() => toast.error("Nem sikerült betölteni a kanban táblát"))
      .finally(() => setKanbanLoading(false));
  }

  useEffect(() => {
    loadProjects();
    loadKanban();
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
    <header className="sticky top-0 z-20 flex h-auto min-h-12 shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-card px-4 py-2">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="h-5 w-px bg-border" />
      <h1 className="text-[14px] font-bold tracking-tight text-foreground">Projektek</h1>
      <div className="flex items-center rounded-lg border border-border p-0.5">
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium",
            view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="size-3.5" /> Lista
        </button>
        <button
          type="button"
          onClick={() => setView("cards")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium",
            view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-3.5" /> Kártyák
        </button>
        <button
          type="button"
          onClick={() => setView("map")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium",
            view === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MapPin className="size-3.5" /> Térkép
        </button>
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium",
            view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <KanbanIcon className="size-3.5" /> Kanban
        </button>
      </div>
      <div className="hidden flex-1 sm:block" />
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Keresés…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-32 rounded-lg border border-border bg-muted/80 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none sm:w-56"
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
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CFG[s];
          return (
            <div key={s} className="rounded-lg border border-border bg-card p-2.5 shadow-sm">
              <p className="text-[10px] font-medium text-muted-foreground">{STATUS_LABELS[s]}</p>
              <p className={cn("text-lg font-bold leading-tight", cfg.statText)}>{counts[s] ?? 0}</p>
            </div>
          );
        })}
      </div>

      {view === "kanban" ? (
        kanbanLoading ? (
          <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">Betöltés…</div>
        ) : (
          <ProjectsKanbanBoard
            board={kanbanBoard}
            columns={Object.keys(kanbanBoard)}
            onChanged={() => { loadKanban(); loadProjects(); }}
          />
        )
      ) : view === "map" ? (
        <ProjectsMap projects={filtered} />
      ) : view === "cards" ? (
        loading ? (
          <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">Betöltés…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-[13px] text-muted-foreground">
            {search ? "Nincs találat" : "Még nincs projekt"}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectBox
                key={p.id}
                project={p}
                onClick={() => router.push(`/projects/${p.id}`)}
                onToggleFavorite={(e) => toggleFavorite(e, p)}
              />
            ))}
          </div>
        )
      ) : (
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-muted/60">
              <th className="w-8 px-3 py-1.5">
                <input
                  type="checkbox"
                  aria-label="Összes kijelölése"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="size-3.5 cursor-pointer accent-primary"
                />
              </th>
              <th className="w-8" />
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Státusz</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Projekt</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ügyfél / helyszín</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Projektvezető</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Határidő</th>
              <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Haladás</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-xs text-muted-foreground">Betöltés…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-xs text-muted-foreground">
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
                  className="cursor-pointer transition-colors hover:bg-muted"
                >
                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`${p.name} kijelölése`}
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="size-3.5 cursor-pointer accent-primary"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      aria-label={p.is_favorite ? "Kedvenc eltávolítása" : "Kedvencnek jelölés"}
                      onClick={(e) => toggleFavorite(e, p)}
                      className="text-muted-foreground/60 hover:text-primary"
                    >
                      <Star className={cn("size-4", p.is_favorite && "fill-primary text-primary")} />
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
                        <p className="text-[12px] font-semibold text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.project_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <p className="text-[12px] text-foreground">{p.client_name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.settlement} · {BUILDING_LABELS[p.building_type] ?? p.building_type}</p>
                  </td>
                  <td className="px-3 py-1.5">
                    {p.project_manager_name ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                          {initials}
                        </div>
                        <span className="text-[11px] text-foreground">{p.project_manager_name}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className={cn("flex items-center gap-1.5 text-[11px]", late ? "text-destructive" : "text-foreground/80")}>
                      <Calendar className="size-3 shrink-0" />
                      {new Date(p.delivery_date).toLocaleDateString("hu-HU")}
                      {late && (
                        <span className="rounded-full bg-critical-bg px-1.5 py-0.5 text-[9px] font-semibold text-critical">Késik</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", cfg.progressBar)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="min-w-[2.5rem] text-right text-[10px] font-medium text-muted-foreground">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <ChevronRight className="size-4 text-muted-foreground/60" />
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
