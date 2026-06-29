"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlarmClock,
  ArrowUpRight,
  Building2,
  Clock3,
  TrendingDown,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, DashboardStats, ProjectCard } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-white ${color}`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 text-3xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  href,
  title,
  subtitle,
  color,
}: {
  href: string;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-2xl p-5 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${color}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <ArrowUpRight className="size-4 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <p className="mt-2 text-sm text-white/80">{subtitle}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [slipping, setSlipping] = useState<ProjectCard[]>([]);

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error);
    api.slippingProjects().then(setSlipping).catch(console.error);
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Áttekintés és figyelmeztetések</p>
      </div>

      {/* Stat cards */}
      {stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Lejárt feladatok"
            value={stats.overdue_tasks}
            icon={TriangleAlert}
            color="bg-red-500"
          />
          <StatCard
            label="Előkészítés 7 napon belül"
            value={stats.upcoming_prep_7d}
            icon={AlarmClock}
            color="bg-amber-500"
          />
          <StatCard
            label="Előkészítés 14 napon belül"
            value={stats.upcoming_prep_14d}
            icon={Clock3}
            color="bg-orange-500"
          />
          <StatCard
            label="Csúszó projektek"
            value={stats.slipping_projects}
            icon={TrendingDown}
            color="bg-sky-500"
          />
          <StatCard
            label="Összes projekt"
            value={stats.total_projects}
            icon={Building2}
            color="bg-blue-600"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border border-slate-200 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="size-12 shrink-0 animate-pulse rounded-2xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-7 w-1/2 animate-pulse rounded bg-slate-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          href="/prep-center?filter=overdue"
          title="Lejárt előkészítések"
          subtitle="Azonnali intézkedés szükséges"
          color="bg-gradient-to-br from-red-500 to-orange-600"
        />
        <ActionCard
          href="/prep-center?filter=7d"
          title="Közelgő 7 nap"
          subtitle="Anyagrendelés, szervezés"
          color="bg-gradient-to-br from-amber-500 to-orange-500"
        />
        <ActionCard
          href="/projects"
          title="Projektek"
          subtitle="Kanban board megnyitása"
          color="bg-gradient-to-br from-blue-600 to-blue-700"
        />
        <ActionCard
          href="/projects"
          title="Csúszó projektek"
          subtitle={slipping.length > 0 ? `${slipping.length} projekt határidőn túl` : "Nincs csúszás"}
          color="bg-gradient-to-br from-sky-500 to-cyan-600"
        />
      </div>

      {/* Slipping projects list */}
      {slipping.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Csúszó projektek</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slipping.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <Card className="border border-slate-200 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    <Badge className="shrink-0 bg-red-100 text-red-700 text-[10px]">
                      {p.completion_percent}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.settlement} · {p.client_name}</p>
                  <Progress value={p.completion_percent} className="mt-2 h-1.5 [&>div]:bg-red-400" />
                  <p className="mt-2 text-xs font-medium text-red-600">
                    Átadás: {new Date(p.delivery_date).toLocaleDateString("hu-HU")}
                  </p>
                  {p.project_manager_name && (
                    <p className="mt-1 text-xs text-slate-400">PM: {p.project_manager_name}</p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
