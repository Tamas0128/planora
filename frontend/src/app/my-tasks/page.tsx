"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ROLE_LABELS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function MyTasksPage() {
  const [items, setItems] = useState<PrepTask[]>([]);

  useEffect(() => {
    api.myTasks().then(setItems).catch(console.error);
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Saját feladatok</h1>
        <p className="text-sm text-slate-500">A szerepkörödhöz tartozó nyitott feladatok</p>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <Card
            key={`${item.project_id}-${item.activity_id}`}
            className={`border p-4 shadow-sm ${item.is_overdue ? "border-l-4 border-l-red-500 bg-red-50/40" : "border-l-4 border-l-blue-400"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/projects/${item.project_id}`}
                  className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {item.project_name}
                </Link>
                <p className="mt-1 text-sm text-slate-800">{item.activity_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.client_name}</p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <Badge variant="secondary" className="text-[10px]">
                  {ROLE_LABELS[item.responsible_role]}
                </Badge>
                {item.prep_date && (
                  <p
                    className={`mt-2 text-xs font-medium ${item.is_overdue ? "text-red-600" : "text-slate-500"}`}
                  >
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
        {items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-slate-400">Nincs nyitott feladat</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
