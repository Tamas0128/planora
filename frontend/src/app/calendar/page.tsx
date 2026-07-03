"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
const MONTH_NAMES = [
  "Január", "Február", "Március", "Április", "Május", "Június",
  "Július", "Augusztus", "Szeptember", "Október", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 2 + i);

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState<PrepTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.prepCenter("all")
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(year, month, d));
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, Array<{ type: "prep" | "start"; task: PrepTask }>> = {};
    for (const task of tasks) {
      if (task.prep_date) {
        const d = task.prep_date.slice(0, 10);
        (map[d] ??= []).push({ type: "prep", task });
      }
      if (task.start_date) {
        const d = task.start_date.slice(0, 10);
        (map[d] ??= []).push({ type: "start", task });
      }
    }
    return map;
  }, [tasks]);

  const todayStr = toDateStr(today);

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Naptár</h1>
          <p className="text-xs text-slate-500">{year}. {MONTH_NAMES[month]}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue>{(v: string) => MONTH_NAMES[Number(v)]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>
            Ma
          </Button>
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-2.5 flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-amber-400" />
          Előkészítés
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-blue-500" />
          Kezdés
        </span>
      </div>

      <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", loading && "opacity-60")}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAY_NAMES.map((day, i) => (
            <div
              key={day}
              className={cn(
                "py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500",
                i >= 5 && "text-slate-400",
              )}
            >
              {day.slice(0, 3)}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {cells.map((cellDate, i) => {
            const dateStr = cellDate ? toDateStr(cellDate) : "";
            const isToday = dateStr === todayStr;
            const events = dateStr ? (eventsByDate[dateStr] ?? []) : [];
            const dow = i % 7;
            const isWeekend = dow >= 5;

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[72px] border-b border-r border-slate-100 p-1",
                  dow === 6 && "border-r-0",
                  !cellDate && "bg-slate-50/60",
                  isWeekend && cellDate && "bg-slate-50/40",
                )}
              >
                {cellDate && (
                  <>
                    <div className="mb-0.5 flex justify-end">
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[11px] font-semibold leading-none",
                          isToday
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600",
                        )}
                      >
                        {cellDate.getDate()}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map((ev, j) => (
                        <Link
                          key={j}
                          href={`/projects/${ev.task.project_id}`}
                          title={`${ev.task.project_name} – ${ev.task.activity_name}`}
                          className={cn(
                            "block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight",
                            ev.type === "prep"
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200",
                          )}
                        >
                          {ev.task.activity_name}
                        </Link>
                      ))}
                      {events.length > 3 && (
                        <p className="px-1 text-[10px] text-slate-400">
                          +{events.length - 3} további
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
