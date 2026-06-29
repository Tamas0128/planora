"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  Building2,
  Clock3,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, DashboardStats, ProjectCard } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function BigStatCard({
  label,
  sublabel,
  value,
  href,
  variant,
}: {
  label: string;
  sublabel?: string;
  value: number | null;
  href: string;
  variant: "danger" | "warning" | "info" | "neutral";
}) {
  const styles = {
    danger: "border-l-4 border-l-red-500",
    warning: "border-l-4 border-l-amber-500",
    info: "border-l-4 border-l-blue-500",
    neutral: "border-l-4 border-l-slate-300",
  };
  const numStyles = {
    danger: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
    neutral: "text-slate-700",
  };

  return (
    <Link href={href} className="block">
      <Card className={cn("p-5 shadow-sm transition hover:shadow-md", styles[variant])}>
        {value === null ? (
          <div className="space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-1/3 animate-pulse rounded bg-slate-200" />
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={cn("mt-1 text-4xl font-bold", numStyles[variant])}>{value}</p>
            {sublabel && <p className="mt-0.5 text-xs text-slate-400">{sublabel}</p>}
          </>
        )}
      </Card>
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

  const v = stats;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Áttekintés és figyelmeztetések</p>
      </div>

      {/* Critical stats – top row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BigStatCard
          label="Lejárt feladatok"
          sublabel="azonnali intézkedés szükséges"
          value={v ? v.overdue_tasks : null}
          href="/prep-center?filter=overdue"
          variant="danger"
        />
        <BigStatCard
          label="Csúszó projektek"
          sublabel="átadási határidőn túl"
          value={v ? v.slipping_projects : null}
          href="/projects"
          variant="warning"
        />
      </div>

      {/* Secondary stats */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BigStatCard
          label="Előkészítés 7 napon belül"
          value={v ? v.upcoming_prep_7d : null}
          href="/prep-center?filter=7d"
          variant="info"
        />
        <BigStatCard
          label="Előkészítés 14 napon belül"
          value={v ? v.upcoming_prep_14d : null}
          href="/prep-center?filter=14d"
          variant="info"
        />
        <BigStatCard
          label="Összes projekt"
          value={v ? v.total_projects : null}
          href="/projects"
          variant="neutral"
        />
      </div>

      {/* Quick navigation */}
      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Gyors navigáció
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/prep-center?filter=overdue", label: "Lejárt előkészítések", icon: TriangleAlert, cls: "text-red-600 border-red-200 hover:bg-red-50" },
            { href: "/prep-center?filter=7d",      label: "7 napon belül",        icon: AlarmClock,    cls: "text-amber-600 border-amber-200 hover:bg-amber-50" },
            { href: "/prep-center?filter=14d",     label: "14 napon belül",       icon: Clock3,        cls: "text-blue-600 border-blue-200 hover:bg-blue-50" },
            { href: "/projects",                   label: "Projektek",            icon: Building2,     cls: "text-slate-700 border-slate-200 hover:bg-slate-50" },
            { href: "/my-tasks",                   label: "Saját feladatok",      icon: TrendingDown,  cls: "text-slate-700 border-slate-200 hover:bg-slate-50" },
          ].map(({ href, label, icon: Icon, cls }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5",
                cls,
              )}
            >
              <Icon className="size-3.5" />
              {label}
              <ArrowRight className="size-3 opacity-50" />
            </Link>
          ))}
        </div>
      </div>

      {/* Slipping projects */}
      {slipping.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Csúszó projektek ({slipping.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slipping.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <Card className="border border-slate-200 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    <Badge className="shrink-0 bg-red-100 text-red-700 text-[10px]">
                      {p.completion_percent}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.settlement} · {p.client_name}</p>
                  <Progress value={p.completion_percent} className="mt-2 h-1.5 [&>div]:bg-red-400" />
                  <p className="mt-2 text-xs font-semibold text-red-600">
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
