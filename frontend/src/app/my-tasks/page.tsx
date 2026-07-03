"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, CheckSquare, ClipboardList, User as UserIcon, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ROLE_LABELS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function taskKey(item: PrepTask) {
  return `${item.project_id}-${item.activity_id}`;
}

const PERIOD_FILTERS = [
  { key: "all", label: "Összes" },
  { key: "overdue", label: "Lejárt" },
  { key: "today", label: "Mai" },
  { key: "7d", label: "7 napon belül" },
  { key: "14d", label: "14 napon belül" },
];

const STATUS_FILTERS = [
  { key: "all", label: "Összes" },
  { key: "pending", label: "Várakozik" },
  { key: "in_progress", label: "Folyamatban" },
  { key: "blocked", label: "Blokkolt" },
];

function matchesPeriod(item: PrepTask, period: string): boolean {
  if (period === "all") return true;
  if (period === "overdue") return item.is_overdue;
  if (item.is_overdue) return false;
  const d = item.days_until;
  if (d === undefined || d === null) return false;
  if (period === "today") return d === 0;
  if (period === "7d") return d >= 0 && d <= 7;
  if (period === "14d") return d >= 0 && d <= 14;
  return true;
}

function TaskRow({ item, selected, onClick }: { item: PrepTask; selected: boolean; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-slate-50",
        item.is_overdue ? "border-l-[3px] border-l-red-500" : "border-l-[3px] border-l-blue-400",
        selected && "bg-blue-50/60 hover:bg-blue-50/60",
      )}
    >
      <div className={cn("size-1.5 shrink-0 rounded-full", item.is_overdue ? "bg-red-500" : "bg-blue-400")} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/projects/${item.project_id}`}
          onClick={(e) => e.stopPropagation()}
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

function TaskDetailPanel({
  item, onClose, onStatusChange,
}: {
  item: PrepTask; onClose: () => void; onStatusChange: (status: string) => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-slate-100 bg-white">
      <div className="flex shrink-0 items-start justify-between border-b border-slate-100 p-3">
        <div className="min-w-0 flex-1 pr-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium", STATUS_COLOR[item.status] ?? "bg-slate-100 text-slate-600")}
            >
              {STATUS_LABEL[item.status] ?? item.status}
            </Badge>
            {item.is_overdue && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">Lejárt</span>
            )}
          </div>
          <h2 className="text-[14px] font-bold leading-snug text-slate-900">{item.activity_name}</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">{item.project_name}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Bezárás"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto p-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ügyfél</p>
          <p className="text-[13px] font-medium text-slate-800">{item.client_name}</p>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Felelős</p>
          <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
            <UserIcon className="size-3.5 shrink-0 text-slate-400" />
            <span>{ROLE_LABELS[item.responsible_role] ?? item.responsible_role}</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dátumok</p>
          <div className="space-y-1.5">
            {item.start_date && (
              <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
                <Calendar className="size-3.5 shrink-0 text-slate-400" />
                <span className="text-slate-400">Kezdés:</span>
                <span>{new Date(item.start_date).toLocaleDateString("hu-HU")}</span>
              </div>
            )}
            {item.prep_date && (
              <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
                <Calendar className="size-3.5 shrink-0 text-slate-400" />
                <span className="text-slate-400">Előkészítés:</span>
                <span className={cn(item.is_overdue && "font-semibold text-red-500")}>
                  {new Date(item.prep_date).toLocaleDateString("hu-HU")}
                </span>
              </div>
            )}
            {!item.start_date && !item.prep_date && (
              <p className="text-[13px] text-slate-400">Nincs megadva</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Státusz</p>
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

      <div className="shrink-0 border-t border-slate-100 p-3">
        <Link
          href={`/projects/${item.project_id}`}
          className="block w-full rounded-lg bg-blue-600 py-2 text-center text-[13px] font-semibold text-white hover:bg-blue-700"
        >
          Projekt megnyitása
        </Link>
      </div>
    </aside>
  );
}

const PAGE_SIZE = 20;

export default function MyTasksPage() {
  const [items, setItems] = useState<PrepTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueVisible, setOverdueVisible] = useState(PAGE_SIZE);
  const [activeVisible, setActiveVisible] = useState(PAGE_SIZE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  function load() {
    return api.myTasks()
      .then(setItems)
      .catch(console.error);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function changePeriodFilter(key: string) {
    setPeriodFilter(key);
    setOverdueVisible(PAGE_SIZE);
    setActiveVisible(PAGE_SIZE);
  }

  function changeStatusFilter(key: string) {
    setStatusFilter(key);
    setOverdueVisible(PAGE_SIZE);
    setActiveVisible(PAGE_SIZE);
  }

  const filteredItems = items.filter(
    (i) => matchesPeriod(i, periodFilter) && (statusFilter === "all" || i.status === statusFilter),
  );
  const overdueItems = filteredItems.filter((i) => i.is_overdue);
  const activeItems = filteredItems.filter((i) => !i.is_overdue);
  const selected = items.find((i) => taskKey(i) === selectedKey) ?? null;

  async function handleStatusChange(item: PrepTask, status: string) {
    await api.updateActivity(item.project_id, item.activity_id, { status });
    await load();
  }

  return (
    <AppLayout mainClassName="flex flex-1 overflow-hidden p-0">
      <div className="flex h-full overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
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

          {!loading && items.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Időszak</span>
                {PERIOD_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={periodFilter === f.key ? "default" : "outline"}
                    className="h-6 px-2 text-[11px]"
                    onClick={() => changePeriodFilter(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Állapot</span>
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
            </div>
          )}

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
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CheckSquare className="mb-4 size-12 text-slate-200" />
              <p className="text-lg font-semibold text-slate-600">Nincs a szűrésnek megfelelő feladat</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => { changePeriodFilter("all"); changeStatusFilter("all"); }}
              >
                Szűrők törlése
              </Button>
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
                    <div key={taskKey(item)} className="border-b border-slate-100 last:border-0">
                      <TaskRow
                        item={item}
                        selected={selectedKey === taskKey(item)}
                        onClick={() => setSelectedKey(selectedKey === taskKey(item) ? null : taskKey(item))}
                      />
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
                    <div key={taskKey(item)} className="border-b border-slate-100 last:border-0">
                      <TaskRow
                        item={item}
                        selected={selectedKey === taskKey(item)}
                        onClick={() => setSelectedKey(selectedKey === taskKey(item) ? null : taskKey(item))}
                      />
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
        </div>

        {selected && (
          <TaskDetailPanel
            item={selected}
            onClose={() => setSelectedKey(null)}
            onStatusChange={(status) => handleStatusChange(selected, status)}
          />
        )}
      </div>
    </AppLayout>
  );
}
