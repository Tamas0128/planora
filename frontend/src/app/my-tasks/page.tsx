"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckSquare, ClipboardList } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ROLE_LABELS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  pending: "Várakozik",
  in_progress: "Folyamatban",
  done: "Kész",
  blocked: "Blokkolt",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  blocked: "bg-red-100 text-red-700",
};

export default function MyTasksPage() {
  const [items, setItems] = useState<PrepTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myTasks()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saját feladatok</h1>
          <p className="text-sm text-slate-500">
            A szerepkörödhöz rendelt nyitott tevékenységek a projektekből
          </p>
        </div>
        <Link href="/projects" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <ClipboardList className="size-3.5" />
          Projektek
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare className="mb-4 size-12 text-slate-200" />
          <p className="text-lg font-semibold text-slate-600">Nincs nyitott feladat</p>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            A feladatok automatikusan keletkeznek a projekt ütemtervéből, a szerepkörödhöz
            rendelt tevékenységekből. Hozz létre projektet, hogy megjelenjenek itt.
          </p>
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-6 gap-1.5")}
          >
            <ClipboardList className="size-3.5" />
            Projektek megtekintése
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card
              key={`${item.project_id}-${item.activity_id}`}
              className={`border p-4 shadow-sm transition hover:shadow-md ${
                item.is_overdue
                  ? "border-l-4 border-l-red-500 bg-red-50/30"
                  : "border-l-4 border-l-blue-400"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${item.project_id}`}
                    className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {item.project_name}
                  </Link>
                  <p className="mt-1 text-sm font-medium text-slate-800">{item.activity_name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.client_name}</p>
                </div>
                <div className="shrink-0 space-y-1.5 text-right">
                  <Badge className={cn("text-[10px]", STATUS_COLOR[item.status] ?? "bg-slate-100 text-slate-600")}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                  <div>
                    <Badge variant="secondary" className="text-[10px]">
                      {ROLE_LABELS[item.responsible_role] ?? item.responsible_role}
                    </Badge>
                  </div>
                  {item.prep_date && (
                    <p className={`text-xs font-medium ${item.is_overdue ? "text-red-600" : "text-slate-500"}`}>
                      Előkész.: {new Date(item.prep_date).toLocaleDateString("hu-HU")}
                    </p>
                  )}
                  {item.days_until !== undefined && item.days_until !== null && (
                    <p className={`text-xs ${item.is_overdue ? "text-red-500" : "text-slate-400"}`}>
                      {item.is_overdue
                        ? `${Math.abs(item.days_until)} napja lejárt`
                        : `${item.days_until} nap múlva`}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
