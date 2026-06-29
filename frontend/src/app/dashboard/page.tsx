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

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  gradient: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-white ${gradient}`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Áttekintés és figyelmeztetések</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Lejárt feladatok"
            value={stats.overdue_tasks}
            icon={TriangleAlert}
            gradient="bg-gradient-to-br from-orange-600 to-amber-700"
          />
          <StatCard
            label="Előkészítés 7 napon belül"
            value={stats.upcoming_prep_7d}
            icon={AlarmClock}
            gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          />
          <StatCard
            label="Előkészítés 14 napon belül"
            value={stats.upcoming_prep_14d}
            icon={Clock3}
            gradient="bg-gradient-to-br from-orange-500 to-amber-600"
          />
          <StatCard
            label="Csúszó projektek"
            value={stats.slipping_projects}
            icon={TrendingDown}
            gradient="bg-gradient-to-br from-sky-500 to-cyan-600"
          />
          <StatCard
            label="Összes projekt"
            value={stats.total_projects}
            icon={Building2}
            gradient="bg-gradient-to-br from-green-600 to-emerald-600"
          />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Link
          href="/prep-center?filter=overdue"
          className="group rounded-xl bg-gradient-to-br from-orange-600 to-amber-700 p-5 text-white shadow-sm transition hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Lejárt előkészítések</h3>
            <ArrowUpRight className="size-4 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="mt-1 text-sm text-white/80">Azonnali intézkedés szükséges</p>
        </Link>
        <Link
          href="/prep-center?filter=7d"
          className="group rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-sm transition hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Közelgő 7 nap</h3>
            <ArrowUpRight className="size-4 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="mt-1 text-sm text-white/80">Anyagrendelés, szervezés</p>
        </Link>
        <Link
          href="/projects"
          className="group rounded-xl bg-gradient-to-br from-green-600 to-emerald-600 p-5 text-white shadow-sm transition hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Projektek</h3>
            <ArrowUpRight className="size-4 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="mt-1 text-sm text-white/80">Kanban board megnyitása</p>
        </Link>
        <Link
          href="/projects"
          className="group rounded-xl bg-gradient-to-br from-sky-600 to-cyan-600 p-5 text-white shadow-sm transition hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Csúszó projektek</h3>
            <ArrowUpRight className="size-4 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="mt-1 text-sm text-white/80">
            {slipping.length > 0 ? `${slipping.length} projekt határidőn túl` : "Nincs csúszás"}
          </p>
        </Link>
      </div>

      {slipping.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Csúszó projektek</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slipping.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <Card className="p-4 transition hover:shadow-md hover:ring-sky-300">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-foreground">{p.name}</span>
                    <Badge className="shrink-0 bg-sky-100 text-sky-700">{p.completion_percent}%</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.settlement} · {p.client_name}</p>
                  <p className="mt-2 text-xs font-medium text-orange-600">
                    Átadás: {new Date(p.delivery_date).toLocaleDateString("hu-HU")}
                  </p>
                  {p.project_manager_name && (
                    <p className="mt-1 text-xs text-muted-foreground">PM: {p.project_manager_name}</p>
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
