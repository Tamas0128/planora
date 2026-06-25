"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ROLE_LABELS } from "@/lib/api";
import { Card } from "@/components/ui/card";

export default function MyTasksPage() {
  const [items, setItems] = useState<PrepTask[]>([]);

  useEffect(() => {
    api.myTasks().then(setItems).catch(console.error);
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Saját feladatok</h1>
        <p className="text-muted-foreground">A szerepkörödhöz tartozó nyitott feladatok</p>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <Card
            key={`${item.project_id}-${item.activity_id}`}
            className={`p-4 ${item.is_overdue ? "border-l-2 border-l-red-500" : "border-l-2 border-l-violet-400"}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/projects/${item.project_id}`} className="font-semibold text-violet-600 hover:underline">
                  {item.project_name}
                </Link>
                <p className="mt-1 text-sm text-foreground">{item.activity_name}</p>
                <p className="text-xs text-muted-foreground">{item.client_name}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">{ROLE_LABELS[item.responsible_role]}</p>
                {item.prep_date && (
                  <p className={`mt-1 ${item.is_overdue ? "font-medium text-red-600" : "text-muted-foreground"}`}>
                    Előkészítés: {new Date(item.prep_date).toLocaleDateString("hu-HU")}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">Nincs nyitott feladat</p>
        )}
      </div>
    </AppLayout>
  );
}
