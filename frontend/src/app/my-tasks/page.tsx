"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Calendar,
  CheckSquare,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  Plus,
  User as UserIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { api, CATEGORY_LABELS, DOCUMENTATION_SUBTYPE_LABELS, PrepTask, ProjectCard, ROLE_LABELS, UserBrief } from "@/lib/api";
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_ORDER,
  CATEGORY_ORDER,
  DOCUMENTATION_SUBTYPE_ORDER,
} from "@/lib/project-utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [string, string][];
const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => [c, CATEGORY_LABELS[c]] as [string, string]);
const DOCUMENTATION_SUBTYPE_OPTIONS = DOCUMENTATION_SUBTYPE_ORDER.map(
  (s) => [s, DOCUMENTATION_SUBTYPE_LABELS[s]] as [string, string],
);
const NEW_TASK_STATUS_OPTIONS = ACTIVITY_STATUS_ORDER.map((s) => [s, ACTIVITY_STATUS_LABELS[s]] as [string, string]);

function makeNewTaskForm() {
  return {
    project_id: "", name: "", responsible_role: "project_manager", assignee_id: "none",
    duration_days: 1, prep_days: 14, status: "pending", category: "other",
    documentation_subtype: undefined as string | undefined, notes: "",
    status_text: "", reminder_date: "",
  };
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Várakozik",
  in_progress: "Folyamatban",
  done: "Kész",
  blocked: "Blokkolt",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  in_progress: "bg-warning-bg text-warning-foreground border-warning",
  done: "bg-neutral-100 text-neutral-700 border-neutral-300",
  blocked: "bg-critical-bg text-critical border-critical",
};

const ROLE_COLOR: Record<string, string> = {
  project_manager: "bg-primary",
  management: "bg-neutral-900",
  procurement: "bg-accent-700",
  billing: "bg-neutral-700",
  admin: "bg-neutral-600",
};

function roleInitials(role: string): string {
  const label = ROLE_LABELS[role] ?? role;
  return label.slice(0, 2).toUpperCase();
}

const STATUS_GROUPS: { key: string; label: string; icon: LucideIcon; iconColor: string }[] = [
  { key: "pending", label: "Várakozik", icon: Circle, iconColor: "text-muted-foreground" },
  { key: "in_progress", label: "Folyamatban", icon: Clock, iconColor: "text-warning" },
  { key: "blocked", label: "Blokkolt", icon: Ban, iconColor: "text-destructive" },
];

function taskKey(item: PrepTask) {
  return `${item.project_id}-${item.activity_id}`;
}

const STATUS_FILTERS = [
  { key: "all", label: "Összes" },
  { key: "pending", label: "Várakozik" },
  { key: "in_progress", label: "Folyamatban" },
  { key: "blocked", label: "Blokkolt" },
];

function taskDate(item: PrepTask): string | undefined {
  return item.prep_date ?? item.start_date;
}

function matchesRange(item: PrepTask, from: string, to: string): boolean {
  if (!from && !to) return true;
  const date = taskDate(item);
  if (!date) return false;
  const d = date.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

type SortKey = "priority" | "activity_name" | "project_name" | "date" | "responsible_role";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "priority", label: "Prioritás" },
  { key: "activity_name", label: "Tevékenység" },
  { key: "project_name", label: "Projekt" },
  { key: "date", label: "Dátum" },
  { key: "responsible_role", label: "Felelős" },
];

// Szabály-alapú "intelligens prioritás" — nincs LLM: lejárt feladatok mindig
// a legelöl, utána a sürgősségi sáv (ma / 7 napon belül / később), azon
// belül a felelős szerepkör súlyozásával (PM/vezetői szerepkörök előrébb).
const ROLE_PRIORITY_WEIGHT: Record<string, number> = {
  admin: 0,
  management: 0,
  project_manager: 1,
  site_manager: 2,
  procurement: 3,
  billing: 3,
  subcontractor: 3,
};

function urgencyTier(item: PrepTask): number {
  if (item.is_overdue) return 0;
  if (item.days_until === 0) return 1;
  if (item.days_until != null && item.days_until <= 7) return 2;
  return 3;
}

function priorityScore(item: PrepTask): number {
  return urgencyTier(item) * 10 + (ROLE_PRIORITY_WEIGHT[item.responsible_role] ?? 3);
}

function sortValue(item: PrepTask, key: SortKey): string {
  switch (key) {
    case "priority": return String(priorityScore(item)).padStart(4, "0");
    case "activity_name": return item.activity_name;
    case "project_name": return item.project_name;
    case "date": return taskDate(item) ?? "";
    case "responsible_role": return ROLE_LABELS[item.responsible_role] ?? item.responsible_role;
  }
}

function sortItems(items: PrepTask[], key: SortKey, dir: "asc" | "desc"): PrepTask[] {
  const sorted = [...items].sort((a, b) => sortValue(a, key).localeCompare(sortValue(b, key), "hu"));
  return dir === "asc" ? sorted : sorted.reverse();
}

function SortableHead({
  label, sortKeyName, sortKey, sortDir, onClick,
}: {
  label: string; sortKeyName: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onClick: () => void;
}) {
  const active = sortKey === sortKeyName;
  return (
    <TableHead
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="cursor-pointer select-none hover:text-foreground"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 text-muted-foreground/60" />
        )}
      </span>
    </TableHead>
  );
}

function TaskTableRow({ item, selected, onClick }: { item: PrepTask; selected: boolean; onClick: () => void }) {
  const date = item.prep_date ?? item.start_date;
  return (
    <TableRow
      onClick={onClick}
      className={cn(
        "cursor-pointer",
        item.is_overdue && "bg-critical-bg/50",
        selected && "bg-accent-200/50 hover:bg-accent-200/50",
      )}
    >
      <TableCell className="font-medium">
        <span className="text-[13px] text-foreground">{item.activity_name}</span>
      </TableCell>
      <TableCell>
        <Link
          href={`/projects/${item.project_id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[13px] font-medium text-primary hover:text-accent-700 hover:underline"
        >
          {item.project_name}
        </Link>
        <p className="text-[11px] text-muted-foreground">{item.client_name}</p>
      </TableCell>
      <TableCell>
        {date ? (
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[12px]", item.is_overdue ? "font-semibold text-destructive" : "text-foreground/80")}>
              {new Date(date).toLocaleDateString("hu-HU")}
            </span>
            {item.days_until !== undefined && item.days_until !== null && (
              <Badge variant="outline" className={cn("text-[10px]", item.is_overdue ? "border-critical bg-critical-bg text-critical" : "border-border text-muted-foreground")}>
                {item.is_overdue ? `${Math.abs(item.days_until)}n lejárt` : `${item.days_until}n múlva`}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-primary-foreground", ROLE_COLOR[item.responsible_role] ?? "bg-neutral-500")}>
            {roleInitials(item.responsible_role)}
          </div>
          <span className="text-[12px] text-muted-foreground">{ROLE_LABELS[item.responsible_role] ?? item.responsible_role}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TaskDetailPanel({
  item, onClose, onStatusChange,
}: {
  item: PrepTask | null; onClose: () => void; onStatusChange: (status: string) => void;
}) {
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-80 flex-col gap-0 p-0">
        {item && (
          <>
            <SheetHeader className="shrink-0 gap-1 border-b border-border p-3 pr-10">
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-medium", STATUS_COLOR[item.status] ?? "bg-muted text-muted-foreground")}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </Badge>
                {item.is_overdue && (
                  <span className="rounded-full bg-critical-bg px-2 py-0.5 text-[10px] font-semibold text-critical">Lejárt</span>
                )}
              </div>
              <SheetTitle className="text-[14px] font-bold leading-snug text-foreground">{item.activity_name}</SheetTitle>
              <SheetDescription className="text-[11px] text-muted-foreground">{item.project_name}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-3.5 overflow-y-auto p-3">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ügyfél</p>
                <p className="text-[13px] font-medium text-foreground">{item.client_name}</p>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Felelős</p>
                <div className="flex items-center gap-1.5 text-[13px] text-foreground/80">
                  <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{ROLE_LABELS[item.responsible_role] ?? item.responsible_role}</span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dátumok</p>
                <div className="space-y-1.5">
                  {item.start_date && (
                    <div className="flex items-center gap-1.5 text-[13px] text-foreground/80">
                      <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Kezdés:</span>
                      <span>{new Date(item.start_date).toLocaleDateString("hu-HU")}</span>
                    </div>
                  )}
                  {item.prep_date && (
                    <div className="flex items-center gap-1.5 text-[13px] text-foreground/80">
                      <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Előkészítés:</span>
                      <span className={cn(item.is_overdue && "font-semibold text-critical")}>
                        {new Date(item.prep_date).toLocaleDateString("hu-HU")}
                      </span>
                    </div>
                  )}
                  {!item.start_date && !item.prep_date && (
                    <p className="text-[13px] text-muted-foreground">Nincs megadva</p>
                  )}
                </div>
              </div>

              {(item.status_text || item.reminder_date) && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Egyéb</p>
                  {item.status_text && (
                    <p className="text-[13px] text-foreground/80">{item.status_text}</p>
                  )}
                  {item.reminder_date && (
                    <div className="mt-1 flex items-center gap-1.5 text-[13px] text-foreground/80">
                      <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Emlékeztető:</span>
                      <span>{new Date(item.reminder_date).toLocaleDateString("hu-HU")}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Státusz</p>
                <Select value={item.status} onValueChange={(v) => v && onStatusChange(v)}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue>{(v: string) => STATUS_LABEL[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="shrink-0 border-t border-border p-3">
              <Link
                href={`/projects/${item.project_id}`}
                className="block w-full rounded-lg bg-primary py-2 text-center text-[13px] font-semibold text-primary-foreground hover:bg-accent-600"
              >
                Projekt megnyitása
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const PAGE_SIZE = 15;

export default function MyTasksPage() {
  const [items, setItems] = useState<PrepTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [showNewTask, setShowNewTask] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState(makeNewTaskForm);

  function load() {
    return api.myTasks()
      .then(setItems)
      .catch(console.error);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    api.usersDirectory().then(setUsers).catch(() => {});
    api.projects().then(setProjects).catch(() => {});
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
        notes: newTaskForm.notes || null,
        status_text: newTaskForm.status_text || null,
        reminder_date: newTaskForm.reminder_date || null,
      });
      if (newTaskForm.status !== "pending") {
        await api.updateActivity(projectId, created.id, { status: newTaskForm.status });
      }
      setShowNewTask(false);
      setNewTaskForm(makeNewTaskForm());
      load();
      toast.success("Feladat létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingTask(false);
    }
  }

  function resetPaging() {
    setVisibleCounts({});
  }

  function changeDateFrom(v: string) {
    setDateFrom(v);
    resetPaging();
  }

  function changeDateTo(v: string) {
    setDateTo(v);
    resetPaging();
  }

  function clearDateRange() {
    setDateFrom("");
    setDateTo("");
    resetPaging();
  }

  function changeStatusFilter(key: string) {
    setStatusFilter(key);
    resetPaging();
  }

  function changeNameFilter(v: string) {
    setNameFilter(v);
    resetPaging();
  }

  function changeProjectFilter(v: string) {
    setProjectFilter(v);
    resetPaging();
  }

  function changeRoleFilter(v: string) {
    setRoleFilter(v);
    resetPaging();
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filteredItems = items.filter(
    (i) =>
      matchesRange(i, dateFrom, dateTo) &&
      (statusFilter === "all" || i.status === statusFilter) &&
      (roleFilter === "all" || i.responsible_role === roleFilter) &&
      (!nameFilter || i.activity_name.toLowerCase().includes(nameFilter.toLowerCase())) &&
      (!projectFilter ||
        i.project_name.toLowerCase().includes(projectFilter.toLowerCase()) ||
        i.client_name.toLowerCase().includes(projectFilter.toLowerCase())),
  );
  const selected = items.find((i) => taskKey(i) === selectedKey) ?? null;

  async function handleStatusChange(item: PrepTask, status: string) {
    await api.updateActivity(item.project_id, item.activity_id, { status });
    await load();
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Saját feladatok</h1>
          <p className="text-xs text-muted-foreground">
            A szerepkörödhöz rendelt nyitott tevékenységek
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewTask(true)}>
            <Plus className="size-3.5" />
            Új feladat
          </Button>
          <Link href="/projects" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <ClipboardList className="size-3.5" />
            Projektek
          </Link>
        </div>
      </div>

      {!loading && items.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Időszak</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => changeDateFrom(e.target.value)}
              className="h-7 w-[150px] text-[12px]"
              aria-label="Tól"
            />
            <span className="text-[12px] text-muted-foreground">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => changeDateTo(e.target.value)}
              className="h-7 w-[150px] text-[12px]"
              aria-label="Ig"
            />
            {(dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={clearDateRange}>
                Törlés
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Állapot</span>
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={statusFilter === f.key ? "default" : "outline"}
                className="h-6 px-2 text-[11px]"
                onClick={() => changeStatusFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tevékenység</span>
            <Input
              type="text"
              value={nameFilter}
              onChange={(e) => changeNameFilter(e.target.value)}
              placeholder="Keresés…"
              className="h-7 w-[160px] text-[12px]"
            />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Projekt</span>
            <Input
              type="text"
              value={projectFilter}
              onChange={(e) => changeProjectFilter(e.target.value)}
              placeholder="Keresés…"
              className="h-7 w-[160px] text-[12px]"
            />
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Felelős</span>
            <Select value={roleFilter} onValueChange={(v) => v && changeRoleFilter(v)}>
              <SelectTrigger size="sm" className="h-7 w-[160px] text-[12px]">
                <SelectValue>{(v: string) => (v === "all" ? "Összes" : ROLE_LABELS[v] ?? v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes</SelectItem>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

          {loading ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-1.5 last:border-0">
                  <div className="size-1.5 rounded-full bg-neutral-200" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-200" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CheckSquare className="mb-4 size-12 text-muted-foreground/40" />
              <p className="text-lg font-semibold text-foreground/80">Nincs nyitott feladat</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                A feladatok automatikusan keletkeznek a projekt ütemtervéből, a szerepkörödhöz
                rendelt tevékenységekből.
              </p>
              <Link
                href="/projects"
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-6 gap-1.5")}
              >
                <ClipboardList className="size-3.5" />
                Projektek megtekintése
              </Link>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CheckSquare className="mb-4 size-12 text-muted-foreground/40" />
              <p className="text-lg font-semibold text-foreground/80">Nincs a szűrésnek megfelelő feladat</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => {
                  clearDateRange();
                  changeStatusFilter("all");
                  changeNameFilter("");
                  changeProjectFilter("");
                  changeRoleFilter("all");
                }}
              >
                Szűrők törlése
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {STATUS_GROUPS.map((group) => {
                const groupItems = filteredItems.filter((i) => i.status === group.key);
                if (groupItems.length === 0) return null;
                const isCollapsed = collapsed.has(group.key);
                const visible = visibleCounts[group.key] ?? PAGE_SIZE;
                const Icon = group.icon;
                return (
                  <div key={group.key} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <button
                      onClick={() => toggleCollapsed(group.key)}
                      className="flex w-full items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-left hover:bg-muted"
                    >
                      <Icon className={cn("size-3.5 shrink-0", group.iconColor)} />
                      <span className="text-[12px] font-semibold text-foreground/80">{group.label}</span>
                      <span className="rounded-full bg-neutral-200/80 px-1.5 text-[10px] font-bold text-muted-foreground">
                        {groupItems.length}
                      </span>
                      <div className="flex-1" />
                      <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
                    </button>
                    {!isCollapsed && (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {SORT_COLUMNS.map((col) => (
                                <SortableHead
                                  key={col.key}
                                  label={col.label}
                                  sortKeyName={col.key}
                                  sortKey={sortKey}
                                  sortDir={sortDir}
                                  onClick={() => toggleSort(col.key)}
                                />
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortItems(groupItems, sortKey, sortDir).slice(0, visible).map((item) => (
                              <TaskTableRow
                                key={taskKey(item)}
                                item={item}
                                selected={selectedKey === taskKey(item)}
                                onClick={() => setSelectedKey(selectedKey === taskKey(item) ? null : taskKey(item))}
                              />
                            ))}
                          </TableBody>
                        </Table>
                        {visible < groupItems.length && (
                          <div className="border-t border-border px-3 py-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVisibleCounts((prev) => ({ ...prev, [group.key]: visible + PAGE_SIZE }))}
                            >
                              {groupItems.length - visible} további megjelenítése
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

      <TaskDetailPanel
        item={selected}
        onClose={() => setSelectedKey(null)}
        onStatusChange={(status) => selected && handleStatusChange(selected, status)}
      />

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
                <Label htmlFor="my-tasks-new-name">Feladat neve</Label>
                <Input
                  id="my-tasks-new-name"
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
                <Label htmlFor="my-tasks-new-duration">Futási idő (nap)</Label>
                <Input
                  id="my-tasks-new-duration"
                  type="number"
                  min={1}
                  required
                  value={newTaskForm.duration_days}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, duration_days: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="my-tasks-new-prep">Előkészítési idő (nap)</Label>
                <Input
                  id="my-tasks-new-prep"
                  type="number"
                  min={1}
                  required
                  value={newTaskForm.prep_days}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, prep_days: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="my-tasks-new-status-text">Szöveges státusz</Label>
                <Input
                  id="my-tasks-new-status-text"
                  placeholder="Opcionális, szabad szöveg…"
                  value={newTaskForm.status_text}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, status_text: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="my-tasks-new-reminder">Emlékeztető</Label>
                <Input
                  id="my-tasks-new-reminder"
                  type="date"
                  value={newTaskForm.reminder_date}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, reminder_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="my-tasks-new-notes">Jegyzet</Label>
                <Textarea
                  id="my-tasks-new-notes"
                  rows={3}
                  value={newTaskForm.notes}
                  onChange={(e) => setNewTaskForm((f) => ({ ...f, notes: e.target.value }))}
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
