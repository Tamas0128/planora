"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Image as ImageIcon, MapPin } from "lucide-react";
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
import { api, BUILDING_LABELS, ProjectCard, PROJECT_STATUS_DEADLINE_FIELD, STATUS_LABELS } from "@/lib/api";
import { clampPercent, pmInitials } from "@/lib/project-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function ProjectCardThumb({ projectId, hasThumbnail }: { projectId: number; hasThumbnail: boolean }) {
  return (
    <div className="flex w-10 shrink-0 items-center justify-center bg-neutral-200 text-neutral-800">
      <ImageIcon className={cn("size-[18px]", !hasThumbnail && "opacity-40")} />
    </div>
  );
}

function ProjectKanbanCardBody({ project, deadlineField }: { project: ProjectCard; deadlineField?: string }) {
  const pct = clampPercent(project.completion_percent);
  const initials = pmInitials(project.project_manager_name);
  const deadline = deadlineField ? (project as unknown as Record<string, string | undefined>)[deadlineField] : undefined;
  const late = !!deadline && deadline < todayIso();
  const radius = 10.25;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (circumference * pct) / 100;

  return (
    <div className="flex border border-border bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
      <ProjectCardThumb projectId={project.id} hasThumbnail={project.has_thumbnail} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13.5px] font-semibold leading-tight text-foreground">{project.name}</p>
          <div className="relative size-6 shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
              <circle cx="12" cy="12" r={radius} fill="none" stroke="var(--color-neutral-200)" strokeWidth="3.5" />
              <circle
                cx="12" cy="12" r={radius} fill="none" stroke="var(--color-accent-500)" strokeWidth="3.5"
                strokeDasharray={circumference} strokeDashoffset={dashoffset} strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[7.5px] font-extrabold text-foreground">{pct}</span>
          </div>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">{project.client_name} · {project.settlement}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-accent-100 text-[8.5px] font-extrabold text-accent-700">
              {initials}
            </span>
            <span className="truncate text-[10.5px] uppercase tracking-wide text-muted-foreground/70">
              {BUILDING_LABELS[project.building_type] ?? project.building_type}
            </span>
          </div>
          <span className={cn("shrink-0 text-[10.5px] font-medium", late ? "text-critical" : "text-muted-foreground")}>
            {deadline ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-2.5" />
                {new Date(deadline).toLocaleDateString("hu-HU")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground/60">
                <MapPin className="size-2.5" />
                nincs határidő
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function DraggableProjectCard({
  project, deadlineField, onClick,
}: {
  project: ProjectCard; deadlineField?: string; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(project.id) });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <ProjectKanbanCardBody project={project} deadlineField={deadlineField} />
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

export function ProjectsKanbanBoard({
  board, columns, onChanged,
}: {
  board: Record<string, ProjectCard[]>;
  columns: string[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ project: ProjectCard; targetStatus: string; deadlineField: string } | null>(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function findProject(id: string): ProjectCard | null {
    for (const list of Object.values(board)) {
      const found = list.find((p) => String(p.id) === id);
      if (found) return found;
    }
    return null;
  }

  async function commitMove(project: ProjectCard, targetStatus: string, deadlineValue?: string) {
    const deadlineField = PROJECT_STATUS_DEADLINE_FIELD[targetStatus];
    const payload: Record<string, unknown> = { status: targetStatus };
    if (deadlineField && deadlineValue) payload[deadlineField] = deadlineValue;
    try {
      await api.updateProject(project.id, payload);
      onChanged();
      toast.success("Projekt státusza frissítve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a státusz módosítása során");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const targetStatus = String(over.id);
    const project = findProject(String(active.id));
    if (!project || project.status === targetStatus) return;

    const deadlineField = PROJECT_STATUS_DEADLINE_FIELD[targetStatus];
    const existingDeadline = deadlineField
      ? (project as unknown as Record<string, string | undefined>)[deadlineField]
      : undefined;

    if (deadlineField && !existingDeadline) {
      setPendingMove({ project, targetStatus, deadlineField });
      setDeadlineInput("");
      return;
    }
    if (deadlineField && existingDeadline && existingDeadline < todayIso()) {
      toast.warning(`A ${STATUS_LABELS[targetStatus] ?? targetStatus} határidő (${new Date(existingDeadline).toLocaleDateString("hu-HU")}) már lejárt`);
    }
    commitMove(project, targetStatus);
  }

  async function confirmPendingMove(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingMove || !deadlineInput) return;
    setSaving(true);
    try {
      await commitMove(pendingMove.project, pendingMove.targetStatus, deadlineInput);
      setPendingMove(null);
    } finally {
      setSaving(false);
    }
  }

  const activeProject = activeId ? findProject(activeId) : null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex min-w-max gap-4 overflow-x-auto pb-2">
          {columns.map((status) => {
            const items = board[status] ?? [];
            return (
              <div key={status} className="flex w-[240px] shrink-0 flex-col">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="flex-1 text-[12.5px] font-extrabold uppercase tracking-wide text-foreground">
                    {STATUS_LABELS[status] ?? status}
                  </h3>
                  <span className="text-[11px] font-bold text-muted-foreground">{items.length}</span>
                </div>
                <div className="mb-2.5 h-0.5 bg-border" />
                <KanbanColumn status={status}>
                  {items.map((p) => (
                    <DraggableProjectCard
                      key={p.id}
                      project={p}
                      deadlineField={PROJECT_STATUS_DEADLINE_FIELD[status]}
                      onClick={() => router.push(`/projects/${p.id}`)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="flex items-center justify-center border-2 border-dashed border-border py-10">
                      <p className="text-[12px] text-muted-foreground">Nincs projekt</p>
                    </div>
                  )}
                </KanbanColumn>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeProject ? <div className="w-[224px]"><ProjectKanbanCardBody project={activeProject} /></div> : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!pendingMove} onOpenChange={(v) => !v && setPendingMove(null)}>
        <DialogContent>
          <form onSubmit={confirmPendingMove}>
            <DialogHeader>
              <DialogTitle>
                {pendingMove ? `${STATUS_LABELS[pendingMove.targetStatus] ?? pendingMove.targetStatus} határidő` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="mb-3 text-[13px] text-muted-foreground">
                &quot;{pendingMove?.project.name}&quot; ehhez a fázishoz még nincs határidő megadva — add meg, mielőtt a kártya átkerül.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="phase-deadline">Határidő</Label>
                <Input
                  id="phase-deadline"
                  type="date"
                  required
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendingMove(null)} disabled={saving}>
                Mégse
              </Button>
              <Button type="submit" disabled={saving || !deadlineInput}>
                {saving ? "Mentés..." : "Mentés és áthelyezés"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
