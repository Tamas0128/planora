"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ROLE_LABELS } from "@/lib/api";

const FILTERS = [
  { key: "all", label: "Összes" },
  { key: "overdue", label: "Lejárt" },
  { key: "today", label: "Mai" },
  { key: "7d", label: "7 napon belül" },
  { key: "14d", label: "14 napon belül" },
];

function PrepCenterContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("filter") || "all";
  const [filter, setFilter] = useState(initial);
  const [items, setItems] = useState<PrepTask[]>([]);

  useEffect(() => {
    api.prepCenter(filter).then(setItems).catch(console.error);
  }, [filter]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === f.key ? "bg-indigo-600 text-white" : "bg-white text-gray-600 shadow-sm"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3">Projekt</th>
              <th className="px-4 py-3">Ügyfél</th>
              <th className="px-4 py-3">Tevékenység</th>
              <th className="px-4 py-3">Előkészítés</th>
              <th className="px-4 py-3">Kezdés</th>
              <th className="px-4 py-3">Felelős</th>
              <th className="px-4 py-3">Státusz</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={`${item.project_id}-${item.activity_id}`}
                className={`border-b hover:bg-gray-50 ${item.is_overdue ? "bg-red-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <Link href={`/projects/${item.project_id}`} className="font-medium text-indigo-600 hover:underline">
                    {item.project_name}
                  </Link>
                </td>
                <td className="px-4 py-3">{item.client_name}</td>
                <td className="px-4 py-3">{item.activity_name}</td>
                <td className="px-4 py-3">
                  {item.prep_date ? new Date(item.prep_date).toLocaleDateString("hu-HU") : "—"}
                </td>
                <td className="px-4 py-3">
                  {item.start_date ? new Date(item.start_date).toLocaleDateString("hu-HU") : "—"}
                </td>
                <td className="px-4 py-3">{ROLE_LABELS[item.responsible_role] || item.responsible_role}</td>
                <td className="px-4 py-3">
                  {item.is_overdue ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Lejárt</span>
                  ) : (
                    <span className="text-gray-500">{item.days_until ?? "—"} nap</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nincs megjeleníthető tétel
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PrepCenterPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Előkészítési központ</h1>
        <p className="text-gray-500">Anyagrendelés, alvállalkozó szervezés, költség jóváhagyás</p>
      </div>
      <Suspense fallback={<p>Betöltés...</p>}>
        <PrepCenterContent />
      </Suspense>
    </AppLayout>
  );
}
