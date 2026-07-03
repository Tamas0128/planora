"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckSquare, ClipboardList } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  pending: "Várakozik",
  in_progress: "Folyamatban",
  done: "Kész",
  blocked: "Blokkolt",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  blocked: "bg-red-100 text-red-700 border-red-200",
};

function TaskRow({ item }: { item: PrepTask }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 transition-colors",
        item.is_overdue ? "border-l-[3px] border-l-red-500" : "border-l-[3px] border-l-blue-400",
      )}
    >
      <div className={cn("size-1.5 shrink-0 rounded-full", item.is_overdue ? "bg-red-500" : "bg-blue-400")} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/projects/${item.project_id}`}
          className="text-[13px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          {item.project_name}
        </Link>
        <p className="truncate text-[11px] text-slate-500">{item.activity_name}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant="outline"
          className={cn("text-[10px] font-medium", STATUS_COLOR[item.status] ?? "bg-slate-100 text-slate-600")}
        >
          {STATUS_LABEL[item.status] ?? item.status}
        </Badge>
        {item.prep_date && (
          <span className={cn("hidden text-[11px] sm:block", item.is_overdue ? "font-medium text-red-600" : "text-slate-400")}>
            {new Date(item.prep_date).toLocaleDateString("hu-HU")}
          </span>
        )}
        {item.days_until !== undefined && item.days_until !== null && (
          <span className={cn("hidden text-[11px] sm:block", item.is_overdue ? "text-red-500" : "text-slate-400")}>
            {item.is_overdue
              ? `${Math.abs(item.days_until)}n lejárt`
              : `${item.days_until}n múlva`}
          </span>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function MyTasksPage() {
  const [items, setItems] = useState<PrepTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueVisible, setOverdueVisible] = useState(PAGE_SIZE);
  const [activeVisible, setActiveVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    api.myTasks()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const overdueItems = items.filter((i) => i.is_overdue);
  const activeItems = items.filter((i) => !i.is_overdue);

  return (
    <AppLayout>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Saját feladatok</h1>
          <p className="text-xs text-slate-500">
            A szerepkörödhöz rendelt nyitott tevékenységek
          </p>
        </div>
        <Link href="/projects" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <ClipboardList className="size-3.5" />
          Projektek
        </Link>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 last:border-0">
              <div className="size-1.5 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckSquare className="mb-4 size-12 text-slate-200" />
          <p className="text-lg font-semibold text-slate-600">Nincs nyitott feladat</p>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
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
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Overdue group */}
          {overdueItems.length > 0 && (
            <>
              <div className="border-b border-slate-100 bg-red-50/50 px-3 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
                  Lejárt ({overdueItems.length})
                </p>
              </div>
              {overdueItems.slice(0, overdueVisible).map((item) => (
                <div key={`${item.project_id}-${item.activity_id}`} className="border-b border-slate-100 last:border-0">
                  <TaskRow item={item} />
                </div>
              ))}
              {overdueVisible < overdueItems.length && (
                <div className="border-b border-slate-100 px-3 py-1.5">
                  <Button size="sm" variant="outline" onClick={() => setOverdueVisible((v) => v + PAGE_SIZE)}>
                    {overdueItems.length - overdueVisible} további megjelenítése
                  </Button>
                </div>
              )}
            </>
          )}
          {/* Active group */}
          {activeItems.length > 0 && (
            <>
              {overdueItems.length > 0 && (
                <div className="border-b border-slate-100 bg-slate-50/50 px-3 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Aktív ({activeItems.length})
                  </p>
                </div>
              )}
              {activeItems.slice(0, activeVisible).map((item) => (
                <div key={`${item.project_id}-${item.activity_id}`} className="border-b border-slate-100 last:border-0">
                  <TaskRow item={item} />
                </div>
              ))}
              {activeVisible < activeItems.length && (
                <div className="px-3 py-1.5">
                  <Button size="sm" variant="outline" onClick={() => setActiveVisible((v) => v + PAGE_SIZE)}>
                    {activeItems.length - activeVisible} további megjelenítése
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
