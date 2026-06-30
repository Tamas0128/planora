"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  api,
  AuditLogEntry,
  DashboardStats,
  PrepTask,
  ProjectCard,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ─── Konfiguráció ───────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; dot: string; bar: string }> = {
  planning:      { label: "Tervezés alatt",    dot: "#0ea5e9", bar: "bg-sky-500" },
  foundation:    { label: "Alapozás",           dot: "#f59e0b", bar: "bg-amber-500" },
  structure:     { label: "Szerkezetállítás",   dot: "#f97316", bar: "bg-orange-500" },
  exterior_done: { label: "Kívülről kész",      dot: "#14b8a6", bar: "bg-teal-500" },
  turnkey:       { label: "Kulcsrakész",        dot: "#10b981", bar: "bg-emerald-500" },
};
const STATUS_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"];

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Várakozik",    cls: "bg-slate-100 text-slate-600" },
  in_progress: { label: "Folyamatban", cls: "bg-amber-100 text-amber-700" },
  done:        { label: "Kész",        cls: "bg-emerald-100 text-emerald-700" },
  blocked:     { label: "Blokkolt",    cls: "bg-red-100 text-red-700" },
};

/* ─── CSS donut chart ────────────────────────────────────────── */
function DonutChart({ segments, total }: { segments: { color: string; pct: number }[]; total: number }) {
  let acc = 0;
  const stops = segments.length
    ? segments.map((s) => { const from = acc; acc += s.pct; return `${s.color} ${from}% ${acc}%`; }).join(", ")
    : "#e2e8f0 0% 100%";
  return (
    <div className="relative mx-auto flex size-40 items-center justify-center">
      <div className="size-40 rounded-full" style={{ background: `conic-gradient(${stops})` }} />
      <div className="absolute flex size-24 flex-col items-center justify-center rounded-full bg-white shadow-sm">
        <span className="text-2xl font-bold text-slate-800">{total}</span>
        <span className="text-[10px] text-slate-500">projekt</span>
      </div>
    </div>
  );
}

/* ─── Stat kártya ────────────────────────────────────────────── */
function StatCard({
  label, value, sub, topColor, href,
}: {
  label: string; value: string | number | null; sub?: string; topColor: string; href: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className={cn("border-t-4 p-4 shadow-sm transition hover:shadow-md", topColor)}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {value === null ? (
          <div className="mt-1 h-8 w-1/2 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-0.5 text-3xl font-bold text-slate-800">{value}</p>
        )}
        {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
      </Card>
    </Link>
  );
}

/* ─── Fő oldal ───────────────────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [kanban, setKanban]     = useState<Record<string, ProjectCard[]>>({});
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [tasks, setTasks]       = useState<PrepTask[]>([]);
  const [logs, setLogs]         = useState<AuditLogEntry[]>([]);
  const [me, setMe]             = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error);
    api.kanban().then(setKanban).catch(console.error);
    api.projects().then(setProjects).catch(console.error);
    api.prepCenter("all").then(setTasks).catch(console.error);
    api.auditLogs().then((l) => setLogs(l.slice(0, 10))).catch(console.error);
    api.me().then(setMe).catch(console.error);
  }, []);

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

  return (
    <AppLayout>
      {/* ── Fejléc ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        {me && (
          <p className="mt-0.5 text-sm text-slate-500">
            Üdvözlünk, <span className="font-semibold text-slate-700">{me.full_name}</span>!
          </p>
        )}
      </div>

      {/* ── 4 Stat kártya ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Aktív projekt"         value={stats?.total_projects ?? null}    sub="Összesen"             topColor="border-t-blue-500"   href="/projects" />
        <StatCard label="Lejárt feladat"        value={stats?.overdue_tasks ?? null}     sub="Azonnali intézkedés"  topColor="border-t-red-500"    href="/prep-center?filter=overdue" />
        <StatCard label="Csúszó projekt"        value={stats?.slipping_projects ?? null} sub="Határidőn túl"        topColor="border-t-amber-500"  href="/projects" />
        <StatCard label="Átlag teljesítmény"    value={avgCompletion !== null ? `${avgCompletion}%` : null} sub="Összes projekt" topColor="border-t-green-600" href="/projects" />
      </div>

      {/* ── Középső sor ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* Projekt áttekintő – donut + lista */}
        <Card className="overflow-hidden py-0 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Projekt áttekintő</h2>
            <Link href="/projects" className="flex items-center gap-0.5 text-xs text-green-700 hover:underline">
              Összes <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="p-4">
            <DonutChart segments={donutSegments} total={total} />
            <div className="mt-4 space-y-2">
              {STATUS_ORDER.map((key) => {
                const count = kanban[key]?.length ?? 0;
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATUS_CFG[key].dot }} />
                    <span className="flex-1 text-slate-600">{STATUS_CFG[key].label}</span>
                    <span className="font-semibold text-slate-700">{count}</span>
                    <span className="w-8 text-right text-slate-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Közelgő projektek */}
        <Card className="overflow-hidden py-0 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Közelgő projektek</h2>
            <Link href="/projects" className="flex items-center gap-0.5 text-xs text-green-700 hover:underline">
              Mind <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {upcomingProjects.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">Nincs projekt</p>
            ) : (
              upcomingProjects.map((p) => {
                const isLate = new Date(p.delivery_date) < new Date();
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{p.name}</p>
                      <p className="truncate text-[10px] text-slate-400">{p.project_manager_name ?? "—"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("text-[10px] font-semibold", isLate ? "text-red-500" : "text-slate-500")}>
                        {new Date(p.delivery_date).toLocaleDateString("hu-HU")}
                      </span>
                      <Badge className="px-1.5 py-0 text-[9px] bg-slate-100 text-slate-600">
                        {p.completion_percent}%
                      </Badge>
                      {isLate && (
                        <Badge className="px-1.5 py-0 text-[9px] bg-red-100 text-red-600">Késik</Badge>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        {/* Közelgő feladatok */}
        <Card className="overflow-hidden py-0 lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Közelgő feladatok</h2>
            <Link href="/my-tasks" className="flex items-center gap-0.5 text-xs text-green-700 hover:underline">
              Mind <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {overdueTasks.length > 0 && (
            <div className="border-b border-red-100 bg-red-50/60 px-4 py-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-500">Lejárt · {overdueTasks.length}</p>
            </div>
          )}
          <div className="divide-y divide-slate-50">
            {[...overdueTasks, ...activeTasks].map((t) => (
              <Link
                key={`${t.project_id}-${t.activity_id}`}
                href={`/projects/${t.project_id}`}
                className={cn(
                  "flex items-start gap-2 px-3 py-2 hover:bg-slate-50 transition-colors",
                  t.is_overdue ? "border-l-[2px] border-l-red-400" : "border-l-[2px] border-l-slate-200",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-700">{t.activity_name}</p>
                  <p className="truncate text-[10px] text-slate-400">{t.project_name}</p>
                </div>
                <Badge className={cn("mt-0.5 shrink-0 px-1.5 py-0 text-[9px]", TASK_STATUS[t.status]?.cls ?? "bg-slate-100 text-slate-600")}>
                  {TASK_STATUS[t.status]?.label ?? t.status}
                </Badge>
              </Link>
            ))}
            {tasks.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">Nincs feladat</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Alsó sor ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* Ütemterv áttekintő – Gantt */}
        <Card className="overflow-hidden py-0 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Ütemterv áttekintő</h2>
            <span className="text-[11px] text-slate-400">következő 90 nap</span>
          </div>
          <div className="p-4">
            {/* X-tengely jelölők */}
            <div className="mb-2 ml-[140px] flex text-[9px] text-slate-400">
              <span className="flex-1 text-left">Ma</span>
              <span className="flex-1 text-center">+30 nap</span>
              <span className="flex-1 text-center">+60 nap</span>
              <span className="flex-1 text-right">+90 nap</span>
            </div>
            <div className="space-y-2">
              {ganttProjects.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">Nincs közelgő projekt</p>
              ) : (
                ganttProjects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 group">
                    <span className="w-[136px] shrink-0 truncate text-[11px] text-slate-600 group-hover:text-slate-900">
                      {p.name}
                    </span>
                    <div className="relative flex-1 h-5 rounded-full bg-slate-100">
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

        {/* Legutóbbi tevékenységek */}
        <Card className="overflow-hidden py-0 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Legutóbbi tevékenységek</h2>
            <Link href="/audit-log" className="flex items-center gap-0.5 text-xs text-green-700 hover:underline">
              Napló <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">Nincs tevékenység</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] font-bold text-green-700">
                    {(log.user_name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-700">
                      <span className="font-semibold">{log.user_name ?? "Ismeretlen"}</span>
                      {" módosította: "}
                      <span className="text-slate-500">{log.field_name}</span>
                      {log.project_name && (
                        <>
                          {" — "}
                          <Link href={`/projects/${log.project_id}`} className="text-green-700 hover:underline">
                            {log.project_name}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(log.created_at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
