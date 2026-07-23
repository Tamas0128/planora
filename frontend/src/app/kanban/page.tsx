"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Image as ImageIcon,
  MapPin,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import AppLayout from "@/components/AppLayout";
import { api, STATUS_LABELS, TaskBoardItem, UserBrief } from "@/lib/api";
import {
  ACTIVITY_STATUS_CFG,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_ORDER,
  isLate,
  pmInitials,
  STATUS_CFG,
} from "@/lib/project-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function CardThumbnail({ projectId, hasThumbnail }: { projectId: number; hasThumbnail: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (hasThumbnail) {
      api.thumbnailUrl(projectId).then((r) => setUrl(r.url)).catch(() => setUrl(null));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset, no async step needed
      setUrl(null);
    }
  }, [projectId, hasThumbnail]);

  if (!hasThumbnail) return null;
  return (
    <div className="size-9 shrink-0 overflow-hidden rounded-md border border-slate-100 bg-slate-50">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static/local asset
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-3.5 text-slate-300" />
      )}
    </div>
  );
}

function TaskCardBody({ item }: { item: TaskBoardItem }) {
  const late = isLate(item.end_date ?? "9999-12-31");
  const cfg = ACTIVITY_STATUS_CFG[item.status] ?? ACTIVITY_STATUS_CFG.pending;

  return (
    <div
      className={cn(
        "rounded-lg border border-l-[3px] bg-white p-2.5 shadow-sm transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
        cfg.leftBorder,
        "border-slate-100/80",
      )}
    >
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{item.project_name}</p>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
        <UserIcon className="size-3 shrink-0 text-slate-400" />
        <span className="truncate">{item.assignee_name ?? "Nincs kijelölve"}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <div className={cn("flex items-center gap-1 text-[11px]", late ? "text-red-400" : "text-slate-400")}>
          <Calendar className="size-3 shrink-0" />
          <span>{item.end_date ? new Date(item.end_date).toLocaleDateString("hu-HU") : "—"}</span>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.badge)}>
          {ACTIVITY_STATUS_LABELS[item.status]}
        </span>
      </div>
    </div>
  );
}

function DraggableTaskCard({
  item, selected, onClick,
}: {
  item: TaskBoardItem; selected: boolean; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(item.activity_id) });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn(
        "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-30",
        selected && "ring-2 ring-blue-500/25 rounded-lg",
      )}
    >
      <TaskCardBody item={item} />
    </div>
  );
}

function KanbanColumn({ status, children }: { status: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("flex flex-col gap-2 rounded-lg p-1 transition-colors", isOver && "bg-blue-50/60")}>
      {children}
    </div>
  );
}

function RightPanel({ item, onClose, onOpen }: { item: TaskBoardItem; onClose: () => void; onOpen: () => void }) {
  const late = isLate(item.end_date ?? "9999-12-31");
  const cfg = ACTIVITY_STATUS_CFG[item.status] ?? ACTIVITY_STATUS_CFG.pending;
  const projectCfg = STATUS_CFG[item.project_status] ?? STATUS_CFG.planning;
  const initials = pmInitials(item.assignee_name);

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-slate-100 bg-white">
      <div className="flex shrink-0 items-start justify-between border-b border-slate-100 p-3">
        <div className="min-w-0 flex-1 pr-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.badge)}>
              {ACTIVITY_STATUS_LABELS[item.status]}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", projectCfg.badge)}>
              {STATUS_LABELS[item.project_status]}
            </span>
          </div>
          <h2 className="text-[14px] font-bold leading-snug text-slate-900">{item.activity_name}</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">{item.project_code}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Bezárás"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto p-3">
        <div className="flex items-center gap-2.5">
          <CardThumbnail projectId={item.project_id} hasThumbnail={item.has_thumbnail} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-800">{item.project_name}</p>
            <p className="truncate text-[11px] text-slate-500">{item.client_name}</p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Felelős</p>
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{initials}</div>
            <span className="text-[13px] font-medium text-slate-800">{item.assignee_name ?? "Nincs kijelölve"}</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Helyszín</p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="size-3 shrink-0" /><span>{item.settlement}</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Határidő</p>
          <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
            <Calendar className="size-3.5 shrink-0 text-slate-400" />
            <span className={cn(late && "font-semibold text-red-500")}>
              {item.end_date ? new Date(item.end_date).toLocaleDateString("hu-HU") : "—"}
            </span>
          </div>
        </div>

        {(item.project_manager_name || item.site_manager_name) && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Projekt kapcsolattartók</p>
            {item.project_manager_name && <p className="text-[12px] text-slate-700">PV: {item.project_manager_name}</p>}
            {item.site_manager_name && <p className="text-[12px] text-slate-700">ÉV: {item.site_manager_name}</p>}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 p-3">
        <button onClick={onOpen} className="w-full rounded-lg bg-blue-600 py-2 text-[13px] font-semibold text-white hover:bg-blue-700">
          Projekt megnyitása
        </button>
      </div>
    </aside>
  );
}

export default function KanbanPage() {
  const router = useRouter();
  const [board, setBoard]         = useState<Record<string, TaskBoardItem[]>>({});
  const [users, setUsers]         = useState<UserBrief[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selected, setSelected]   = useState<TaskBoardItem | null>(null);
  const [activeId, setActiveId]   = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    api.taskKanban()
      .then(setBoard)
      .catch(() => toast.error("Nem sikerült betölteni a feladatok listáját"))
      .finally(() => setLoading(false));
    api.usersDirectory().then(setUsers).catch(() => {});
  }, []);

  const q = search.toLowerCase();

  function matches(item: TaskBoardItem) {
    const searchOk = !q ||
      item.project_name.toLowerCase().includes(q) ||
      item.client_name.toLowerCase().includes(q);
    const assigneeOk = assigneeFilter === "all" || String(item.assignee_id ?? "") === assigneeFilter;
    return searchOk && assigneeOk;
  }

  function findItem(activityId: number): { status: string; item: TaskBoardItem } | null {
    for (const [status, items] of Object.entries(board)) {
      const item = items.find((i) => i.activity_id === activityId);
      if (item) return { status, item };
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activityId = Number(active.id);
    const targetStatus = String(over.id);
    const found = findItem(activityId);
    if (!found || found.status === targetStatus) return;

    const prevBoard = board;
    setBoard((prev) => {
      const next = { ...prev };
      next[found.status] = next[found.status].filter((i) => i.activity_id !== activityId);
      next[targetStatus] = [...(next[targetStatus] ?? []), { ...found.item, status: targetStatus }];
      return next;
    });

    api.updateActivity(found.item.project_id, found.item.activity_id, { status: targetStatus }).catch((err) => {
      setBoard(prevBoard);
      toast.error(err instanceof Error ? err.message : "Hiba a státusz módosítása során");
    });
  }

  const draggedItem = activeId ? findItem(Number(activeId))?.item : null;

  const pageHeader = (
    <header className="sticky top-0 z-20 flex h-auto min-h-12 shrink-0 flex-wrap items-center gap-2.5 border-b border-slate-100 bg-white px-4 py-2">
      <SidebarTrigger className="text-slate-400 hover:text-slate-700" />
      <div className="h-5 w-px bg-slate-100" />
      <h1 className="text-[14px] font-bold tracking-tight text-slate-900">Kanban tábla</h1>
      <div className="hidden flex-1 sm:block" />
      <Select value={assigneeFilter} onValueChange={(v) => v && setAssigneeFilter(v)}>
        <SelectTrigger size="sm" className="h-8 w-[160px] text-[13px]">
          <SelectValue>
            {(v: string) => (v === "all" ? "Minden felelős" : users.find((u) => String(u.id) === v)?.full_name ?? "Minden felelős")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Minden felelős</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Projekt keresése…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-32 rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none sm:w-52"
        />
      </div>
    </header>
  );

  return (
    <AppLayout header={pageHeader} mainClassName="flex flex-1 overflow-hidden p-0">
      <div className="flex h-full overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-slate-50/60">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-[13px] text-slate-400">Betöltés…</span>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-w-max gap-4 p-4">
                {ACTIVITY_STATUS_ORDER.map((status) => {
                  const items = (board[status] ?? []).filter(matches);
                  return (
                    <div key={status} className="flex w-[240px] shrink-0 flex-col">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="flex-1 text-[12px] font-semibold text-slate-700">{ACTIVITY_STATUS_LABELS[status]}</h3>
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-50 px-1.5 text-[11px] font-bold text-emerald-700">
                          {items.length}
                        </span>
                      </div>
                      <div className="mb-2.5 h-px bg-slate-200/70" />
                      <KanbanColumn status={status}>
                        {items.map((item) => (
                          <DraggableTaskCard
                            key={item.activity_id}
                            item={item}
                            selected={selected?.activity_id === item.activity_id}
                            onClick={() => setSelected(selected?.activity_id === item.activity_id ? null : item)}
                          />
                        ))}
                        {items.length === 0 && (
                          <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-10">
                            <p className="text-[12px] text-slate-400">Nincs feladat</p>
                          </div>
                        )}
                      </KanbanColumn>
                    </div>
                  );
                })}
              </div>
              <DragOverlay>
                {draggedItem ? <div className="w-[224px]"><TaskCardBody item={draggedItem} /></div> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Right panel */}
        {selected && (
          <RightPanel
            item={selected}
            onClose={() => setSelected(null)}
            onOpen={() => router.push(`/projects/${selected.project_id}`)}
          />
        )}
      </div>
    </AppLayout>
  );
}
