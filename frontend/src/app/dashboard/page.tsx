"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, Clock, Gauge, GripVertical, Star, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AppLayout from "@/components/AppLayout";
import {
  api,
  AuditLogEntry,
  DashboardStats,
  DigestPreview,
  PrepTask,
  ProjectCard,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ─── Konfiguráció ───────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; dot: string; bar: string }> = {
  planning:      { label: "Tervezés alatt",    dot: "var(--color-status-planning)",      bar: "bg-status-planning" },
  foundation:    { label: "Alapozás",           dot: "var(--color-status-foundation)",    bar: "bg-status-foundation" },
  structure:     { label: "Szerkezetállítás",   dot: "var(--color-status-structure)",     bar: "bg-status-structure" },
  exterior_done: { label: "Kívülről kész",      dot: "var(--color-status-exterior_done)", bar: "bg-status-exterior_done" },
  turnkey:       { label: "Kulcsrakész",        dot: "var(--color-status-turnkey)",       bar: "bg-status-turnkey" },
};
const STATUS_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"];

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Várakozik",    cls: "bg-neutral-100 text-neutral-600" },
  in_progress: { label: "Folyamatban", cls: "bg-warning-bg text-warning-foreground" },
  done:        { label: "Kész",        cls: "bg-neutral-200 text-neutral-900" },
  blocked:     { label: "Blokkolt",    cls: "bg-critical-bg text-critical" },
};

const WIDGET_ORDER_KEY = "planora_dashboard_widget_order";
const DEFAULT_WIDGET_ORDER = ["status", "upcoming", "tasks", "favorites", "digest", "gantt", "log"];
const WIDGET_SPAN: Record<string, string> = {
  status: "lg:col-span-4",
  upcoming: "lg:col-span-5",
  tasks: "lg:col-span-3",
  favorites: "lg:col-span-4",
  digest: "lg:col-span-4",
  gantt: "lg:col-span-8",
  log: "lg:col-span-5",
};

function loadWidgetOrder(): string[] {
  if (typeof window === "undefined") return DEFAULT_WIDGET_ORDER;
  try {
    const raw = window.localStorage.getItem(WIDGET_ORDER_KEY);
    if (!raw) return DEFAULT_WIDGET_ORDER;
    const parsed = JSON.parse(raw) as string[];
    // Guard against a stale saved order missing/adding widgets after an update.
    if (
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_WIDGET_ORDER.length &&
      DEFAULT_WIDGET_ORDER.every((id) => parsed.includes(id))
    ) {
      return parsed;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_WIDGET_ORDER;
}

/* ─── CSS donut chart ────────────────────────────────────────── */
function DonutChart({ segments, total }: { segments: { color: string; pct: number }[]; total: number }) {
  let acc = 0;
  const stops = segments.length
    ? segments.map((s) => { const from = acc; acc += s.pct; return `${s.color} ${from}% ${acc}%`; }).join(", ")
    : "#eae7e7 0% 100%";
  return (
    <div className="relative mx-auto flex size-28 items-center justify-center">
      <div className="size-28 rounded-full" style={{ background: `conic-gradient(${stops})` }} />
      <div className="absolute flex size-16 flex-col items-center justify-center rounded-full bg-card shadow-sm">
        <span className="text-lg font-bold text-foreground">{total}</span>
        <span className="text-[9px] text-muted-foreground">projekt</span>
      </div>
    </div>
  );
}

/* ─── Stat kártya (kompakt info-box) ─────────────────────────── */
function StatCard({
  label, value, sub, icon: Icon, iconBg, iconColor, href,
}: {
  label: string; value: string | number | null; sub?: string;
  icon: LucideIcon; iconBg: string; iconColor: string; href: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="flex-row items-center gap-3 p-3 shadow-sm transition hover:shadow-md">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("size-4.5", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          {value === null ? (
            <div className="mt-1 h-5 w-1/2 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-xl font-bold leading-tight text-foreground">{value}</p>
          )}
        </div>
        {sub && <p className="shrink-0 text-[10px] text-muted-foreground">{sub}</p>}
      </Card>
    </Link>
  );
}

/* ─── Drag handle wrapper ─────────────────────────────────────── */
function SortableWidget({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn("relative", className)}>
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Widget áthelyezése"
        className="absolute right-2 top-2 z-10 cursor-grab touch-none rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      {children}
    </div>
  );
}

/* ─── Fő oldal ───────────────────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [kanban, setKanban]     = useState<Record<string, ProjectCard[]>>({});
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [tasks, setTasks]       = useState<PrepTask[]>([]);
  const [logs, setLogs]         = useState<AuditLogEntry[]>([]);
  const [digest, setDigest]     = useState<DigestPreview | null>(null);
  const [me, setMe]             = useState<{ full_name: string } | null>(null);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(loadWidgetOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error);
    api.kanban().then(setKanban).catch(console.error);
    api.projects().then(setProjects).catch(console.error);
    api.prepCenter("all").then(setTasks).catch(console.error);
    api.auditLogs().then((l) => setLogs(l.slice(0, 10))).catch(console.error);
    api.me().then(setMe).catch(console.error);
    api.digestPreview().then(setDigest).catch(console.error);
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWidgetOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      const next = arrayMove(prev, oldIndex, newIndex);
      window.localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }

  /* Donut adatok */
  const total = Object.values(kanban).reduce((s, col) => s + col.length, 0);
  const donutSegments = STATUS_ORDER
    .filter((k) => (kanban[k]?.length ?? 0) > 0)
    .map((k) => ({
      color: STATUS_CFG[k].dot,
      pct:   total > 0 ? ((kanban[k]?.length ?? 0) / total) * 100 : 0,
    }));

  /* Átlag teljesítmény */
  const avgCompletion = useMemo(() => {
    const all = Object.values(kanban).flat();
    if (!all.length) return null;
    return Math.round(all.reduce((s, p) => s + p.completion_percent, 0) / all.length);
  }, [kanban]);

  /* Közelgő projektek – deadline szerint rendezve */
  const upcomingProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime()).slice(0, 8),
    [projects],
  );

  const favoriteProjects = useMemo(() => projects.filter((p) => p.is_favorite), [projects]);

  /* Feladatok */
  const overdueTasks = tasks.filter((t) => t.is_overdue).slice(0, 5);
  const activeTasks  = tasks.filter((t) => !t.is_overdue).slice(0, 6);

  /* Ütemterv – projetek delivery_date alapján, ma + 90 nap */
  const ganttProjects = useMemo(() => {
    const today = new Date();
    const end90 = new Date(today.getTime() + 90 * 86400000);
    return [...projects]
      .filter((p) => new Date(p.delivery_date) >= today && new Date(p.delivery_date) <= end90)
      .sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime())
      .slice(0, 8)
      .map((p) => {
        const days  = Math.max(1, Math.round((new Date(p.delivery_date).getTime() - today.getTime()) / 86400000));
        const pct   = Math.max(4, Math.min(96, (days / 90) * 100));
        const cfg   = STATUS_CFG[p.status] ?? STATUS_CFG.planning;
        return { ...p, days, pct, barColor: cfg.bar };
      });
  }, [projects]);

  const widgetContent: Record<string, React.ReactNode> = {
    status: (
      <Card className="h-full overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold text-foreground">Projekt áttekintő</h2>
          <Link href="/projects" className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            Összes <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="p-3">
          <DonutChart segments={donutSegments} total={total} />
          <div className="mt-3 space-y-1.5">
            {STATUS_ORDER.map((key) => {
              const count = kanban[key]?.length ?? 0;
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-2 text-[11px]">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_CFG[key].dot }} />
                  <span className="flex-1 text-foreground/80">{STATUS_CFG[key].label}</span>
                  <span className="font-semibold text-foreground">{count}</span>
                  <span className="w-8 text-right text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    ),
    upcoming: (
      <Card className="h-full overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold text-foreground">Közelgő projektek</h2>
          <Link href="/projects" className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            Mind <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {upcomingProjects.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nincs projekt</p>
          ) : (
            upcomingProjects.map((p) => {
              const isLate = new Date(p.delivery_date) < new Date();
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">{p.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{p.project_manager_name ?? "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn("text-[10px] font-semibold", isLate ? "text-destructive" : "text-muted-foreground")}>
                      {new Date(p.delivery_date).toLocaleDateString("hu-HU")}
                    </span>
                    <Badge className="px-1.5 py-0 text-[9px] bg-neutral-100 text-neutral-700">
                      {p.completion_percent}%
                    </Badge>
                    {isLate && (
                      <Badge className="px-1.5 py-0 text-[9px] bg-critical-bg text-critical">Késik</Badge>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>
    ),
    tasks: (
      <Card className="h-full overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold text-foreground">Közelgő feladatok</h2>
          <Link href="/my-tasks" className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            Mind <ArrowUpRight className="size-3" />
          </Link>
        </div>
        {overdueTasks.length > 0 && (
          <div className="border-b border-critical-bg bg-critical-bg/60 px-3 py-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">Lejárt · {overdueTasks.length}</p>
          </div>
        )}
        <div className="divide-y divide-border">
          {[...overdueTasks, ...activeTasks].map((t) => (
            <Link
              key={`${t.project_id}-${t.activity_id}`}
              href={`/projects/${t.project_id}`}
              className={cn(
                "flex items-start gap-2 px-2.5 py-1.5 hover:bg-muted transition-colors",
                t.is_overdue ? "border-l-[2px] border-l-destructive" : "border-l-[2px] border-l-border",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-foreground">{t.activity_name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{t.project_name}</p>
              </div>
              <Badge className={cn("mt-0.5 shrink-0 px-1.5 py-0 text-[9px]", TASK_STATUS[t.status]?.cls ?? "bg-neutral-100 text-neutral-700")}>
                {TASK_STATUS[t.status]?.label ?? t.status}
              </Badge>
            </Link>
          ))}
          {tasks.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">Nincs feladat</p>
          )}
        </div>
      </Card>
    ),
    favorites: (
      <Card className="h-full overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold text-foreground">Kedvencek</h2>
          <Star className="size-3.5 fill-accent-500 text-accent-500" />
        </div>
        <div className="divide-y divide-border">
          {favoriteProjects.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nincs kedvencnek jelölt projekt</p>
          ) : (
            favoriteProjects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-foreground">{p.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{p.settlement} · {p.client_name}</p>
                </div>
                <Badge className="px-1.5 py-0 text-[9px] bg-neutral-100 text-neutral-700">{p.completion_percent}%</Badge>
              </Link>
            ))
          )}
        </div>
      </Card>
    ),
    digest: (
      <Card className="h-full overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold text-foreground">Napi összefoglaló</h2>
        </div>
        <div className="max-h-[280px] space-y-3 overflow-y-auto p-3">
          {!digest || (digest.overdue.length === 0 && digest.upcoming.length === 0) ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nincs lejárt vagy közelgő előkészítés</p>
          ) : (
            <>
              {digest.overdue.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-destructive">
                    Lejárt előkészítések · {digest.overdue.length}
                  </p>
                  <ul className="space-y-1">
                    {digest.overdue.slice(0, 5).map((t) => (
                      <li key={`${t.project_id}-${t.activity_id}`}>
                        <Link href={`/projects/${t.project_id}`} className="text-[11px] text-foreground hover:underline">
                          {t.project_name} / {t.activity_name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {digest.upcoming.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
                    Közelgő előkészítések (7 napon belül) · {digest.upcoming.length}
                  </p>
                  <ul className="space-y-1">
                    {digest.upcoming.slice(0, 5).map((t) => (
                      <li key={`${t.project_id}-${t.activity_id}`}>
                        <Link href={`/projects/${t.project_id}`} className="text-[11px] text-foreground hover:underline">
                          {t.project_name} / {t.activity_name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    ),
    gantt: (
      <Card className="h-full overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold text-foreground">Ütemterv áttekintő</h2>
          <span className="text-[10px] text-muted-foreground">következő 90 nap</span>
        </div>
        <div className="p-3">
          <div className="mb-1.5 ml-[124px] flex text-[9px] text-muted-foreground">
            <span className="flex-1 text-left">Ma</span>
            <span className="flex-1 text-center">+30 nap</span>
            <span className="flex-1 text-center">+60 nap</span>
            <span className="flex-1 text-right">+90 nap</span>
          </div>
          <div className="space-y-1.5">
            {ganttProjects.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nincs közelgő projekt</p>
            ) : (
              ganttProjects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 group">
                  <span className="w-[120px] shrink-0 truncate text-[11px] text-foreground/80 group-hover:text-foreground">
                    {p.name}
                  </span>
                  <div className="relative flex-1 h-4 rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", p.barColor)}
                      style={{ width: `${p.pct}%` }}
                      title={`${p.days} nap múlva`}
                    />
                    <span className="absolute right-1.5 top-0 flex h-full items-center text-[9px] font-semibold text-white mix-blend-overlay">
                      {p.days}n
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </Card>
    ),
    log: (
      <Card className="h-full overflow-hidden py-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold text-foreground">Legutóbbi tevékenységek</h2>
          <Link href="/audit-log" className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">
            Napló <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {logs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nincs tevékenység</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 px-3 py-1.5">
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[9px] font-bold text-neutral-700">
                  {(log.user_name ?? "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-foreground">
                    <span className="font-semibold">{log.user_name ?? "Ismeretlen"}</span>
                    {" módosította: "}
                    <span className="text-muted-foreground">{log.field_name}</span>
                    {log.project_name && (
                      <>
                        {" — "}
                        <Link href={`/projects/${log.project_id}`} className="text-primary hover:underline">
                          {log.project_name}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    ),
  };

  return (
    <AppLayout>
      {/* ── Fejléc ── */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
        {me && (
          <p className="text-xs text-muted-foreground">
            Üdvözlünk, <span className="font-semibold text-foreground">{me.full_name}</span>!
          </p>
        )}
      </div>

      {/* ── 4 Stat kártya ── */}
      <div className="mb-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Aktív projekt"      value={stats?.total_projects ?? null}    sub="Összesen"            icon={Building2}    iconBg="bg-accent"       iconColor="text-accent-foreground" href="/projects" />
        <StatCard label="Lejárt feladat"     value={stats?.overdue_tasks ?? null}     sub="Azonnal"             icon={Clock}        iconBg="bg-critical-bg"  iconColor="text-critical"          href="/prep-center?filter=overdue" />
        <StatCard label="Csúszó projekt"     value={stats?.slipping_projects ?? null} sub="Határidőn túl"       icon={TrendingDown} iconBg="bg-warning-bg"   iconColor="text-warning-foreground" href="/projects" />
        <StatCard label="Átlag teljesítmény" value={avgCompletion !== null ? `${avgCompletion}%` : null} sub="Összesen" icon={Gauge} iconBg="bg-neutral-100" iconColor="text-neutral-700" href="/projects" />
      </div>

      {/* ── Vezetői KPI-k ── */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Card className="p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Határidőre készül</p>
          <p className="mt-1 text-xl font-bold leading-tight text-foreground">
            {stats ? `${stats.on_time_delivery_pct}%` : "…"}
          </p>
        </Card>
        <Card className="p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Havi átadások</p>
          <p className="mt-1 text-xl font-bold leading-tight text-foreground">{stats?.handovers_this_month ?? "…"}</p>
        </Card>
        <Card className="p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nyitott előkészítés</p>
          <p className="mt-1 text-xl font-bold leading-tight text-foreground">{stats?.open_prep_tasks_total ?? "…"}</p>
        </Card>
      </div>

      {/* ── Testreszabható widget-rács ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            {widgetOrder.map((id) => (
              <SortableWidget key={id} id={id} className={WIDGET_SPAN[id]}>
                {widgetContent[id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </AppLayout>
  );
}
