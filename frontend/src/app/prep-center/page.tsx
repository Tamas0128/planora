"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
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

const PAGE_SIZE = 25;

function PrepCenterContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("filter") || "all";
  const [filter, setFilter] = useState(initial);
  const [items, setItems] = useState<PrepTask[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .prepCenter(filter)
      .then(setItems)
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  function changeFilter(key: string) {
    setFilter(key);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visibleItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => changeFilter(f.key)}
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
              <TableHead>Státusz</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Tevékenység</TableHead>
              <TableHead>Előkészítés</TableHead>
              <TableHead>Kezdés</TableHead>
              <TableHead>Felelős</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> Betöltés...
                  </span>
                </TableCell>
              </TableRow>
            )}
            {!loading && loadError && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <span>Nem sikerült betölteni a listát</span>
                    <Button variant="outline" size="sm" onClick={load}>
                      Újrapróbálkozás
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              !loadError &&
              visibleItems.map((item) => (
                <TableRow
                  key={`${item.project_id}-${item.activity_id}`}
                  className={item.is_overdue ? "border-l-4 border-l-critical bg-critical-bg/40" : ""}
                >
                  <TableCell>
                    <Link href={`/projects/${item.project_id}`} className="font-medium text-primary hover:text-accent-700 hover:underline">
                      {item.project_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {item.is_overdue ? (
                      <Badge className="bg-critical-bg text-critical">Lejárt</Badge>
                    ) : (
                      <span className="text-muted-foreground">{item.days_until ?? "—"} nap</span>
                    )}
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
                </TableRow>
              ))}
            {!loading && !loadError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nincs megjeleníthető tétel
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} / {items.length}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Előző
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Következő
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default function PrepCenterPage() {
  return (
    <AppLayout>
      <div className="mb-3">
        <h1 className="text-lg font-heading font-bold text-foreground">Előkészítési központ</h1>
        <p className="text-xs text-muted-foreground">Anyagrendelés, alvállalkozó szervezés, költség jóváhagyás</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Betöltés...</p>}>
        <PrepCenterContent />
      </Suspense>
    </AppLayout>
  );
}
