"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Image as ImageIcon,
  MapPin,
  Plus,
  Search,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  api,
  CATEGORY_LABELS,
  DOCUMENTATION_SUBTYPE_LABELS,
  ProjectCard,
  ROLE_LABELS,
  STATUS_LABELS,
  TaskBoardItem,
  UserBrief,
} from "@/lib/api";
import {
  ACTIVITY_STATUS_CFG,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_ORDER,
  CATEGORY_ICONS,
  CATEGORY_ORDER,
  DOCUMENTATION_SUBTYPE_ORDER,
  isLate,
  pmInitials,
  STATUS_CFG,
} from "@/lib/project-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [string, string][];
const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => [c, CATEGORY_LABELS[c]] as [string, string]);
const DOCUMENTATION_SUBTYPE_OPTIONS = DOCUMENTATION_SUBTYPE_ORDER.map(
  (s) => [s, DOCUMENTATION_SUBTYPE_LABELS[s]] as [string, string],
);

const PROGRESS_RING_RADIUS = 10.25;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

function statusToPercent(status: string): number {
  if (status === "done") return 100;
  if (status === "in_progress") return 50;
  if (status === "blocked") return 25;
  return 0;
}

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
    <div className="size-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static/local asset
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-3.5 text-muted-foreground/60" />
      )}
    </div>
  );
}

function TaskCardBody({ item }: { item: TaskBoardItem }) {
  const late = isLate(item.end_date ?? "9999-12-31");
  const Icon = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.other;
  const initials = pmInitials(item.assignee_name);
  const pct = statusToPercent(item.status);
  const dashoffset = PROGRESS_RING_CIRCUMFERENCE - (PROGRESS_RING_CIRCUMFERENCE * pct) / 100;

  return (
    <div className="flex border border-border bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
      <div className="flex w-10 shrink-0 items-center justify-center bg-neutral-200 text-neutral-800">
        <Icon className="size-[18px]" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13.5px] font-semibold leading-tight text-foreground">{item.activity_name}</p>
          <div className="relative size-6 shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
              <circle cx="12" cy="12" r={PROGRESS_RING_RADIUS} fill="none" stroke="var(--color-neutral-200)" strokeWidth="3.5" />
              <circle
                cx="12" cy="12" r={PROGRESS_RING_RADIUS} fill="none" stroke="var(--color-accent-500)" strokeWidth="3.5"
                strokeDasharray={PROGRESS_RING_CIRCUMFERENCE} strokeDashoffset={dashoffset} strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[7.5px] font-extrabold text-foreground">{pct}</span>
          </div>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{item.project_name}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-accent-100 text-[8.5px] font-extrabold text-accent-700">
              {initials}
            </span>
            <span className="truncate text-[10.5px] uppercase tracking-wide text-muted-foreground/70">
              {CATEGORY_LABELS[item.category] || item.category}
            </span>
          </div>
          <span className={cn("shrink-0 text-[10.5px] font-medium", late ? "text-critical" : "text-muted-foreground")}>
            {item.end_date ? new Date(item.end_date).toLocaleDateString("hu-HU") : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function DraggableTaskCard({
  item, selected, onClick,
}: {
  item: TaskBoardItem; selected: boolean; onClick: () => void;
}) {
  // Each card is both draggable AND its own drop target (same id, separate
  // dnd-kit registries) — this is what lets a dragged card be dropped on
  // top of another card to land at that position, not just at the column's
  // end (which is all a column-level-only droppable could ever resolve to).
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: String(item.activity_id) });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: String(item.activity_id) });

  return (
    <div
      ref={setDropRef}
      className={cn("transition-shadow", isOver && "ring-2 ring-primary/60")}
    >
      <div
        ref={setDragRef}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
        className={cn(
          "cursor-grab touch-none active:cursor-grabbing",
          isDragging && "opacity-30",
          selected && "ring-2 ring-primary/25",
        )}
      >
        <TaskCardBody item={item} />
      </div>
    </div>
  );
}

function KanbanColumn({ status, children }: { status: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("flex flex-col gap-2 p-1 transition-colors", isOver && "bg-accent")}>
      {children}
    </div>
  );
}

function RightPanel({
  item, users, onClose, onOpen, onUpdated, onDeleted,
}: {
  item: TaskBoardItem;
  users: UserBrief[];
  onClose: () => void;
  onOpen: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const late = isLate(item.end_date ?? "9999-12-31");
  const cfg = ACTIVITY_STATUS_CFG[item.status] ?? ACTIVITY_STATUS_CFG.pending;
  const projectCfg = STATUS_CFG[item.project_status] ?? STATUS_CFG.planning;
  const initials = pmInitials(item.assignee_name);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: item.activity_name,
    responsible_role: item.responsible_role,
    assignee_id: item.assignee_id ? String(item.assignee_id) : "none",
    duration_days: item.duration_days,
    category: item.category,
    documentation_subtype: item.documentation_subtype,
  });

  useEffect(() => {
    setForm({
      name: item.activity_name,
      responsible_role: item.responsible_role,
      assignee_id: item.assignee_id ? String(item.assignee_id) : "none",
      duration_days: item.duration_days,
      category: item.category,
      documentation_subtype: item.documentation_subtype,
    });
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.activity_id]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateActivity(item.project_id, item.activity_id, {
        name: form.name,
        responsible_role: form.responsible_role,
        assignee_id: form.assignee_id === "none" ? null : Number(form.assignee_id),
        duration_days: Number(form.duration_days),
        category: form.category,
        documentation_subtype: form.category === "documentation" ? form.documentation_subtype : null,
      });
      setEditing(false);
      onUpdated();
      toast.success("Feladat mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.deleteActivity(item.project_id, item.activity_id);
      toast.success("Feladat törölve");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-80 max-w-[85vw] flex-col gap-0 p-0 sm:max-w-80 [&>button]:hidden"
      >
      <SheetHeader className="sr-only">
        <SheetTitle>{item.activity_name}</SheetTitle>
        <SheetDescription>Feladat részletei</SheetDescription>
      </SheetHeader>
      <div className="flex shrink-0 items-start justify-between border-b border-border p-3">
        <div className="min-w-0 flex-1 pr-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.badge)}>
              {ACTIVITY_STATUS_LABELS[item.status]}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", projectCfg.badge)}>
              {STATUS_LABELS[item.project_status]}
            </span>
          </div>
          {editing ? (
            <Input
              value={form.name}
              aria-label="Feladat neve"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-7 text-[13px] font-bold"
            />
          ) : (
            <h2 className="text-[14px] font-bold leading-snug text-foreground">{item.activity_name}</h2>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.project_code}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Bezárás"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto p-3">
        <div className="flex items-center gap-2.5">
          <CardThumbnail projectId={item.project_id} hasThumbnail={item.has_thumbnail} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{item.project_name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{item.client_name}</p>
          </div>
        </div>

        {editing ? (
          <>
            <div>
              <Label className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kijelölve</Label>
              <Select value={form.assignee_id} onValueChange={(v) => setForm((f) => ({ ...f, assignee_id: v as string }))}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>
                    {() => users.find((u) => String(u.id) === form.assignee_id)?.full_name ?? "Nincs kijelölve"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs kijelölve</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Felelős szerepkör</Label>
              <Select value={form.responsible_role} onValueChange={(v) => setForm((f) => ({ ...f, responsible_role: v as string }))}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>{(v: string) => ROLE_LABELS[v] || v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kanban-edit-duration" className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Futási idő (nap)
              </Label>
              <Input
                id="kanban-edit-duration"
                type="number"
                min={1}
                value={form.duration_days}
                onChange={(e) => setForm((f) => ({ ...f, duration_days: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kategória</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as string, documentation_subtype: v === "documentation" ? f.documentation_subtype : undefined }))}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>{(v: string) => CATEGORY_LABELS[v] || v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === "documentation" && (
              <div>
                <Label className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dokumentáció altípusa</Label>
                <Select
                  value={form.documentation_subtype ?? ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, documentation_subtype: v as string }))}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue>{(v: string) => DOCUMENTATION_SUBTYPE_LABELS[v] || "Válassz altípust"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENTATION_SUBTYPE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Felelős</p>
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{initials}</div>
              <span className="text-[13px] font-medium text-foreground">{item.assignee_name ?? "Nincs kijelölve"}</span>
            </div>
          </div>
        )}

        {!editing && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kategória</p>
            <div className="flex items-center gap-1.5 text-[13px] text-foreground/80">
              {(() => {
                const Icon = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.other;
                return <Icon className="size-3.5 shrink-0 text-muted-foreground" />;
              })()}
              <span>
                {CATEGORY_LABELS[item.category] || item.category}
                {item.category === "documentation" && item.documentation_subtype && (
                  <span className="text-muted-foreground"> · {DOCUMENTATION_SUBTYPE_LABELS[item.documentation_subtype]}</span>
                )}
              </span>
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Helyszín</p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" /><span>{item.settlement}</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Határidő</p>
          <div className="flex items-center gap-1.5 text-[13px] text-foreground/80">
            <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
            <span className={cn(late && "font-semibold text-critical")}>
              {item.end_date ? new Date(item.end_date).toLocaleDateString("hu-HU") : "—"}
            </span>
          </div>
        </div>

        {!editing && (item.project_manager_name || item.site_manager_name) && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Projekt kapcsolattartók</p>
            {item.project_manager_name && <p className="text-[12px] text-foreground/80">PV: {item.project_manager_name}</p>}
            {item.site_manager_name && <p className="text-[12px] text-foreground/80">ÉV: {item.site_manager_name}</p>}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border p-3">
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>
              Mégse
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Mentés..." : "Mentés"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditing(true)}>
              Szerkesztés
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" className="flex-1 text-destructive" />}>
                Törlés
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Biztosan törlöd ezt a feladatot?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{item.activity_name}&quot; archiválásra kerül és eltűnik az ütemtervből és a kanban
                    tábláról. Az adatai megmaradnak, de nem jelenik meg többé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Mégse</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                    Törlés
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        <button onClick={onOpen} className="w-full rounded-lg bg-primary py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">
          Projekt megnyitása
        </button>
      </div>
      </SheetContent>
    </Sheet>
  );
}

const NEW_TASK_STATUS_OPTIONS = ACTIVITY_STATUS_ORDER.map((s) => [s, ACTIVITY_STATUS_LABELS[s]] as [string, string]);

function makeNewTaskForm() {
  return {
    project_id: "", name: "", responsible_role: "project_manager", assignee_id: "none",
    duration_days: 1, prep_days: 14, status: "pending", category: "other",
    documentation_subtype: undefined as string | undefined,
  };
}

export default function KanbanPage() {
  const router = useRouter();
  const [board, setBoard]         = useState<Record<string, TaskBoardItem[]>>({});
  const [users, setUsers]         = useState<UserBrief[]>([]);
  const [projects, setProjects]   = useState<ProjectCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selected, setSelected]   = useState<TaskBoardItem | null>(null);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState(makeNewTaskForm);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function loadBoard() {
    return api.taskKanban()
      .then((b) => {
        setBoard(b);
        if (selected) {
          const stillThere = Object.values(b).flat().find((i) => i.activity_id === selected.activity_id);
          setSelected(stillThere ?? null);
        }
        return b;
      })
      .catch(() => toast.error("Nem sikerült betölteni a feladatok listáját"));
  }

  useEffect(() => {
    loadBoard().finally(() => setLoading(false));
    api.usersDirectory().then(setUsers).catch(() => {});
    api.projects().then(setProjects).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskForm.project_id) {
      toast.error("Válassz projektet");
      return;
    }
    setCreatingTask(true);
    try {
      const projectId = Number(newTaskForm.project_id);
      const created = await api.createActivity(projectId, {
        name: newTaskForm.name,
        responsible_role: newTaskForm.responsible_role,
        assignee_id: newTaskForm.assignee_id === "none" ? null : Number(newTaskForm.assignee_id),
        duration_days: Number(newTaskForm.duration_days),
        prep_days: Number(newTaskForm.prep_days),
        category: newTaskForm.category,
        documentation_subtype: newTaskForm.category === "documentation" ? newTaskForm.documentation_subtype : null,
      });
      if (newTaskForm.status !== "pending") {
        await api.updateActivity(projectId, created.id, { status: newTaskForm.status });
      }
      setShowNewTask(false);
      setNewTaskForm(makeNewTaskForm());
      loadBoard();
      toast.success("Feladat létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingTask(false);
    }
  }

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
    const found = findItem(activityId);
    if (!found) return;

    // `over.id` is either a column's status (dropped on empty column space)
    // or another card's activity_id (dropped on top of a specific card) —
    // in the latter case the card's own status/index tells us both which
    // column it landed in and exactly where, instead of always appending
    // to the column's end.
    const overId = String(over.id);
    const overCard = ACTIVITY_STATUS_ORDER.includes(overId as (typeof ACTIVITY_STATUS_ORDER)[number])
      ? null
      : findItem(Number(overId));
    const targetStatus = overCard ? overCard.status : overId;
    if (!ACTIVITY_STATUS_ORDER.includes(targetStatus as (typeof ACTIVITY_STATUS_ORDER)[number])) return;
    if (found.status === targetStatus && (!overCard || overCard.item.activity_id === activityId)) return;

    const statusChanged = found.status !== targetStatus;
    const prevBoard = board;
    setBoard((prev) => {
      const next = { ...prev };
      next[found.status] = next[found.status].filter((i) => i.activity_id !== activityId);
      const movedItem = { ...found.item, status: targetStatus };
      const destItems = [...(next[targetStatus] ?? [])];
      const targetIndex = overCard ? destItems.findIndex((i) => i.activity_id === overCard.item.activity_id) : -1;
      if (targetIndex === -1) destItems.push(movedItem);
      else destItems.splice(targetIndex, 0, movedItem);
      next[targetStatus] = destItems;
      return next;
    });

    if (statusChanged) {
      api.updateActivity(found.item.project_id, found.item.activity_id, { status: targetStatus }).catch((err) => {
        setBoard(prevBoard);
        toast.error(err instanceof Error ? err.message : "Hiba a státusz módosítása során");
      });
    }
  }

  const draggedItem = activeId ? findItem(Number(activeId))?.item : null;

  const pageHeader = (
    <header className="sticky top-0 z-20 flex h-auto min-h-12 shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-card px-4 py-2">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="h-5 w-px bg-border" />
      <h1 className="text-[14px] font-bold tracking-tight text-foreground">Kanban tábla</h1>
      <div className="hidden flex-1 sm:block" />
      <Button size="sm" onClick={() => setShowNewTask(true)}>
        <Plus className="size-3.5" /> Új feladat
      </Button>
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
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Projekt keresése…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-32 rounded-lg border border-border bg-muted/80 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none sm:w-52"
        />
      </div>
    </header>
  );

  return (
    <AppLayout header={pageHeader} mainClassName="flex flex-1 overflow-hidden p-0">
      <div className="flex h-full overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-muted/60">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-[13px] text-muted-foreground">Betöltés…</span>
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
                      <div className="mb-2 flex items-baseline justify-between">
                        <h3 className="flex-1 text-[12.5px] font-extrabold uppercase tracking-wide text-foreground">{ACTIVITY_STATUS_LABELS[status]}</h3>
                        <span className="text-[11px] font-bold text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      <div className="mb-2.5 h-0.5 bg-border" />
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
                          <div className="flex items-center justify-center border-2 border-dashed border-border py-10">
                            <p className="text-[12px] text-muted-foreground">Nincs feladat</p>
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
            users={users}
            onClose={() => setSelected(null)}
            onOpen={() => router.push(`/projects/${selected.project_id}`)}
            onUpdated={loadBoard}
            onDeleted={() => { setSelected(null); loadBoard(); }}
          />
        )}
      </div>

      <Dialog open={showNewTask} onOpenChange={(v) => { setShowNewTask(v); if (!v) setNewTaskForm(makeNewTaskForm()); }}>
        <DialogContent>
          <form onSubmit={createTask}>
            <DialogHeader>
              <DialogTitle>Új feladat</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label>Projekt</Label>
                <Select
                  value={newTaskForm.project_id}
                  onValueChange={(v) => setNewTaskForm((f) => ({ ...f, project_id: v as string }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {() => projects.find((p) => String(p.id) === newTaskForm.project_id)?.name ?? "Válassz projektet"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.project_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-task-name">Feladat neve</Label>
                <Input
                  id="new-task-name"
                  required
                  value={newTaskForm.name}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kategória</Label>
                <Select
                  value={newTaskForm.category}
                  onValueChange={(v) => setNewTaskForm((f) => ({ ...f, category: v as string, documentation_subtype: v === "documentation" ? f.documentation_subtype : undefined }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => CATEGORY_LABELS[v] || v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newTaskForm.category === "documentation" && (
                <div className="space-y-1.5">
                  <Label>Dokumentáció altípusa</Label>
                  <Select
                    value={newTaskForm.documentation_subtype ?? ""}
                    onValueChange={(v) => setNewTaskForm((f) => ({ ...f, documentation_subtype: v as string }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: string) => DOCUMENTATION_SUBTYPE_LABELS[v] || "Válassz altípust"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENTATION_SUBTYPE_OPTIONS.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Felelős szerepkör</Label>
                <Select
                  value={newTaskForm.responsible_role}
                  onValueChange={(v) => setNewTaskForm((f) => ({ ...f, responsible_role: v as string }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => ROLE_LABELS[v] || v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kijelölve</Label>
                <Select
                  value={newTaskForm.assignee_id}
                  onValueChange={(v) => setNewTaskForm((f) => ({ ...f, assignee_id: v as string }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {() => users.find((u) => String(u.id) === newTaskForm.assignee_id)?.full_name ?? "Nincs kijelölve"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nincs kijelölve</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kezdő állapot</Label>
                <Select
                  value={newTaskForm.status}
                  onValueChange={(v) => setNewTaskForm((f) => ({ ...f, status: v as string }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => ACTIVITY_STATUS_LABELS[v] || v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {NEW_TASK_STATUS_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-task-duration">Futási idő (nap)</Label>
                <Input
                  id="new-task-duration"
                  type="number"
                  min={1}
                  required
                  value={newTaskForm.duration_days}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, duration_days: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-task-prep">Előkészítési idő (nap)</Label>
                <Input
                  id="new-task-prep"
                  type="number"
                  min={1}
                  required
                  value={newTaskForm.prep_days}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, prep_days: Number(e.target.value) }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creatingTask}>
                {creatingTask ? "Mentés..." : "Létrehozás"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
