"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ROLE_LABELS } from "@/lib/api";

export default function MyTasksPage() {
  const [items, setItems] = useState<PrepTask[]>([]);

  useEffect(() => {
    api.myTasks().then(setItems).catch(console.error);
  }, []);

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Saját feladatok</h1>
        <p className="text-gray-500">A szerepkörödhöz tartozó nyitott feladatok</p>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <div
            key={`${item.project_id}-${item.activity_id}`}
            className={`rounded-xl bg-white p-4 shadow-sm ${item.is_overdue ? "border-l-4 border-red-500" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/projects/${item.project_id}`} className="font-semibold text-indigo-600 hover:underline">
                  {item.project_name}
                </Link>
                <p className="mt-1 text-sm text-gray-600">{item.activity_name}</p>
                <p className="text-xs text-gray-400">{item.client_name}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-500">{ROLE_LABELS[item.responsible_role]}</p>
                {item.prep_date && (
                  <p className={`mt-1 ${item.is_overdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                    Előkészítés: {new Date(item.prep_date).toLocaleDateString("hu-HU")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-12 text-center text-gray-400">Nincs nyitott feladat</p>
        )}
      </div>
    </AppLayout>
  );
}
