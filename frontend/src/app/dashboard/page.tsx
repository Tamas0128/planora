"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, DashboardStats } from "@/lib/api";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error);
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Áttekintés és figyelmeztetések</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Lejárt feladatok" value={stats.overdue_tasks} color="text-red-600" />
          <StatCard label="Előkészítés 7 napon belül" value={stats.upcoming_prep_7d} color="text-amber-600" />
          <StatCard label="Előkészítés 14 napon belül" value={stats.upcoming_prep_14d} color="text-orange-600" />
          <StatCard label="Csúszó projektek" value={stats.slipping_projects} color="text-violet-600" />
          <StatCard label="Összes projekt" value={stats.total_projects} color="text-indigo-600" />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/prep-center?filter=overdue" className="rounded-xl bg-red-50 p-5 hover:bg-red-100">
          <h3 className="font-semibold text-red-800">Lejárt előkészítések</h3>
          <p className="mt-1 text-sm text-red-600">Azonnali intézkedés szükséges</p>
        </Link>
        <Link href="/prep-center?filter=7d" className="rounded-xl bg-amber-50 p-5 hover:bg-amber-100">
          <h3 className="font-semibold text-amber-800">Közelgő 7 nap</h3>
          <p className="mt-1 text-sm text-amber-600">Anyagrendelés, szervezés</p>
        </Link>
        <Link href="/projects" className="rounded-xl bg-indigo-50 p-5 hover:bg-indigo-100">
          <h3 className="font-semibold text-indigo-800">Projektek</h3>
          <p className="mt-1 text-sm text-indigo-600">Kanban board megnyitása</p>
        </Link>
      </div>
    </AppLayout>
  );
}
