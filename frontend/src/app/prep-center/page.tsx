"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, PrepTask, ROLE_LABELS } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
                : ""
            }
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Tevékenység</TableHead>
              <TableHead>Előkészítés</TableHead>
              <TableHead>Kezdés</TableHead>
              <TableHead>Felelős</TableHead>
              <TableHead>Státusz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={`${item.project_id}-${item.activity_id}`}
                className={item.is_overdue ? "border-l-2 border-l-red-500 bg-red-50/50" : ""}
              >
                <TableCell>
                  <Link href={`/projects/${item.project_id}`} className="font-medium text-violet-600 hover:underline">
                    {item.project_name}
                  </Link>
                </TableCell>
                <TableCell>{item.client_name}</TableCell>
                <TableCell>{item.activity_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.prep_date ? new Date(item.prep_date).toLocaleDateString("hu-HU") : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.start_date ? new Date(item.start_date).toLocaleDateString("hu-HU") : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ROLE_LABELS[item.responsible_role] || item.responsible_role}
                </TableCell>
                <TableCell>
                  {item.is_overdue ? (
                    <Badge className="bg-red-100 text-red-700">Lejárt</Badge>
                  ) : (
                    <span className="text-muted-foreground">{item.days_until ?? "—"} nap</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nincs megjeleníthető tétel
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export default function PrepCenterPage() {
  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Előkészítési központ</h1>
        <p className="text-muted-foreground">Anyagrendelés, alvállalkozó szervezés, költség jóváhagyás</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Betöltés...</p>}>
        <PrepCenterContent />
      </Suspense>
    </AppLayout>
  );
}
