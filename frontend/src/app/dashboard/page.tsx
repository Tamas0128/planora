"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ProjectCard as ProjectCardType } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ── Kanban oszlop konfiguráció ────────────────────────────── */
const COLUMNS: { key: string; label: string; pill: string; bar: string }[] = [
  { key: "planning",      label: "Tervezés alatt",   pill: "bg-sky-500",     bar: "[&>div]:bg-sky-400" },
  { key: "foundation",    label: "Alapozás",          pill: "bg-amber-500",   bar: "[&>div]:bg-amber-400" },
  { key: "structure",     label: "Szerkezetállítás",  pill: "bg-orange-500",  bar: "[&>div]:bg-orange-400" },
  { key: "exterior_done", label: "Kívülről kész",     pill: "bg-teal-500",    bar: "[&>div]:bg-teal-400" },
  { key: "turnkey",       label: "Kulcsrakész",       pill: "bg-emerald-500", bar: "[&>div]:bg-emerald-400" },
];

const TASK_STATUS_COLOR: Record<string, string> = {
  pending:     "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  done:        "bg-emerald-100 text-emerald-700",
  blocked:     "bg-red-100 text-red-700",
};
const TASK_STATUS_LABEL: Record<string, string> = {
  pending:     "Várakozik",
  in_progress: "Folyamatban",
  done:        "Kész",
  blocked:     "Blokkolt",
};

/* ── Projekt kártya a kanban oszlopban ──────────────────────── */
function ProjectCard({ project, bar }: { project: ProjectCardType; bar: string }) {
  const isLate = new Date(project.delivery_date) < new Date();
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="cursor-pointer p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {project.project_code}
        </p>
        <p className="mt-0.5 text-sm font-semibold leading-tight text-slate-800">{project.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {project.settlement} · {project.client_name}
        </p>
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500">{project.completion_percent}%</span>
            <span className={cn("text-[10px]", isLate ? "font-semibold text-red-500" : "text-slate-400")}>
              {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
            </span>
          </div>
          <Progress value={project.completion_percent} className={cn("h-1.5", bar)} />
        </div>
        {project.project_manager_name && (
          <p className="mt-1.5 text-[10px] text-slate-400">PM: {project.project_manager_name}</p>
        )}
      </Card>
    </Link>
  );
}

/* ── Fő komponens ───────────────────────────────────────────── */
export default function DashboardPage() {
  const [kanban, setKanban]         = useState<Record<string, ProjectCardType[]>>({});
  const [tasks, setTasks]           = useState<PrepTask[]>([]);
  const [loadingK, setLoadingK]     = useState(true);
  const [loadingT, setLoadingT]     = useState(true);

  useEffect(() => {
    api.kanban()
      .then(setKanban).catch(console.error)
      .finally(() => setLoadingK(false));
    api.prepCenter("all")
      .then(setTasks).catch(console.error)
      .finally(() => setLoadingT(false));
  }, []);

  const totalProjects  = Object.values(kanban).reduce((s, col) => s + col.length, 0);
  const overdueTasks   = tasks.filter((t) => t.is_overdue);
  const activeTasks    = tasks.filter((t) => !t.is_overdue);
  const scheduledTasks = tasks
    .filter((t) => t.prep_date || t.start_date)
    .sort((a, b) => {
      const da = new Date(a.prep_date ?? a.start_date ?? "").getTime();
      const db = new Date(b.prep_date ?? b.start_date ?? "").getTime();
      return da - db;
    })
    .slice(0, 14);

  return (
    <AppLayout>
      {/* ── Fejléc ── */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Irányítópult</h1>
          <p className="text-xs text-slate-500">
            {loadingK ? "…" : `${totalProjects} aktív projekt`}
            {!loadingT && overdueTasks.length > 0 && (
              <span className="ml-2 font-semibold text-red-500">
                · {overdueTasks.length} lejárt feladat
              </span>
            )}
          </p>
        </div>
        <Link href="/projects">
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            Új projekt
          </Button>
        </Link>
      </div>

      {/* ── Kanban projekt áttekintő ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const projects = kanban[col.key] ?? [];
          return (
            <div key={col.key} className="flex flex-col gap-2">
              {/* Oszlopfejléc */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
                    col.pill,
                  )}
                >
                  {col.label}
                </span>
                <span className="ml-1.5 text-xs font-semibold text-slate-400">{projects.length}</span>
              </div>

              {/* Kártyák */}
              <div className="space-y-2">
                {loadingK ? (
                  [1, 2].map((i) => (
                    <div key={i} className="h-[84px] animate-pulse rounded-xl bg-slate-100" />
                  ))
                ) : projects.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400">
                    Nincs projekt
                  </div>
                ) : (
                  projects.map((p) => (
                    <ProjectCard key={p.id} project={p} bar={col.bar} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Alsó két panel ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Feladatlista */}
        <Card className="overflow-hidden py-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Feladatok</h2>
            <Link
              href="/prep-center"
              className="flex items-center gap-0.5 text-xs text-green-700 hover:underline"
            >
              Összes <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {/* Lejárt csoport */}
          {overdueTasks.length > 0 && (
            <>
              <div className="border-b border-red-100 bg-red-50/60 px-4 py-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-500">
                  Lejárt · {overdueTasks.length}
                </p>
              </div>
              {overdueTasks.slice(0, 4).map((t) => (
                <TaskRow key={`od-${t.project_id}-${t.activity_id}`} task={t} />
              ))}
            </>
          )}

          {/* Aktív csoport */}
          {activeTasks.length > 0 && (
            <>
              <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Közelgő · {activeTasks.length}
                </p>
              </div>
              {activeTasks.slice(0, 8).map((t) => (
                <TaskRow key={`ac-${t.project_id}-${t.activity_id}`} task={t} />
              ))}
            </>
          )}

          {loadingT && (
            <div className="space-y-0.5 p-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          )}
          {!loadingT && tasks.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-400">Nincs feladat</p>
          )}
        </Card>

        {/* Ütemterv nézet */}
        <Card className="overflow-hidden py-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ütemterv / feladat nézet</h2>
            <Link
              href="/calendar"
              className="flex items-center gap-0.5 text-xs text-green-700 hover:underline"
            >
              Naptár <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-50">
            {loadingT ? (
              <div className="space-y-0.5 p-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-7 animate-pulse rounded bg-slate-100" />
                ))}
              </div>
            ) : scheduledTasks.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">Nincs ütemezett feladat</p>
            ) : (
              scheduledTasks.map((t) => {
                const isStart   = !!t.start_date;
                const dateStr   = t.start_date ?? t.prep_date ?? "";
                const dateLabel = new Date(dateStr).toLocaleDateString("hu-HU", {
                  month: "short",
                  day:   "numeric",
                });
                return (
                  <Link
                    key={`sc-${t.project_id}-${t.activity_id}-${isStart ? "s" : "p"}`}
                    href={`/projects/${t.project_id}`}
                    className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-slate-50"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        isStart ? "bg-blue-500" : "bg-amber-400",
                      )}
                    />
                    <span className="w-16 shrink-0 text-[10px] text-slate-400">{dateLabel}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                      {t.activity_name}
                    </span>
                    <span className="ml-1 hidden shrink-0 max-w-[90px] truncate text-[10px] text-slate-400 sm:block">
                      {t.project_name}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          {/* Jelmagyarázat */}
          <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-400" />
              Előkészítés
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500" />
              Kezdés
            </span>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

/* ── Feladatsor segédkomponens ──────────────────────────────── */
function TaskRow({ task }: { task: PrepTask }) {
  return (
    <Link
      href={`/projects/${task.project_id}`}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-slate-50",
        task.is_overdue
          ? "border-l-[3px] border-l-red-400"
          : "border-l-[3px] border-l-slate-200",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-700">{task.activity_name}</p>
        <p className="truncate text-[10px] text-slate-400">{task.project_name}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Badge
          className={cn(
            "px-1.5 py-0 text-[9px]",
            TASK_STATUS_COLOR[task.status] ?? "bg-slate-100 text-slate-600",
          )}
        >
          {TASK_STATUS_LABEL[task.status] ?? task.status}
        </Badge>
        {task.prep_date && (
          <span
            className={cn(
              "text-[9px]",
              task.is_overdue ? "font-semibold text-red-500" : "text-slate-400",
            )}
          >
            {new Date(task.prep_date).toLocaleDateString("hu-HU")}
          </span>
        )}
      </div>
    </Link>
  );
}
