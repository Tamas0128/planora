"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  api,
  FOUNDATION_TYPE_LABELS,
  getCachedUser,
  ROOF_COVERING_LABELS,
  ROUGH_ESTIMATE_CATEGORY_LABELS,
  RoughEstimateRate,
  User,
  WALL_TYPE_LABELS,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function variantLabel(rate: RoughEstimateRate): string {
  if (rate.wall_type) return WALL_TYPE_LABELS[rate.wall_type] ?? rate.wall_type;
  if (rate.roof_covering_type) return ROOF_COVERING_LABELS[rate.roof_covering_type] ?? rate.roof_covering_type;
  if (rate.foundation_type) return FOUNDATION_TYPE_LABELS[rate.foundation_type] ?? rate.foundation_type;
  return "—";
}

export default function CostEstimateRatesPage() {
  const [rates, setRates] = useState<RoughEstimateRate[]>([]);
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [savingId, setSavingId] = useState<number | null>(null);

  function load() {
    api.costEstimateRates().then(setRates).catch(() => setRates([]));
  }

  useEffect(() => {
    load();
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "billing";

  async function saveField(rate: RoughEstimateRate, field: "price_economy" | "price_standard" | "price_premium", value: string) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    setSavingId(rate.id);
    try {
      const updated = await api.updateCostEstimateRate(rate.id, { [field]: num });
      setRates((prev) => prev.map((r) => (r.id === rate.id ? updated : r)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSavingId(null);
    }
  }

  const grouped = rates.reduce<Record<string, RoughEstimateRate[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="mb-3">
        <h1 className="text-lg font-heading font-bold text-foreground">Költségbecslés ártábla</h1>
        <p className="text-xs text-muted-foreground">
          A projekt fülön elérhető gyorsbecslés (m²/fm-alapú, nagyságrendi) kategóriánkénti Ft egységárai,
          kivitelezési szintenként. A kezdeti értékek tájékoztató jellegűek — kalibráld a valós piaci árakra.
        </p>
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategória</TableHead>
              <TableHead>Variáns</TableHead>
              <TableHead>Gazdaságos (Ft)</TableHead>
              <TableHead>Standard (Ft)</TableHead>
              <TableHead>Prémium (Ft)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(grouped).map(([category, rows]) =>
              rows.map((rate, idx) => (
                <TableRow key={rate.id}>
                  <TableCell className="text-xs font-medium">
                    {idx === 0 ? (ROUGH_ESTIMATE_CATEGORY_LABELS[category] ?? category) : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{variantLabel(rate)}</TableCell>
                  {(["price_economy", "price_standard", "price_premium"] as const).map((field) => (
                    <TableCell key={field}>
                      {canEdit ? (
                        <Input
                          type="number"
                          min="0"
                          step="1000"
                          defaultValue={rate[field]}
                          disabled={savingId === rate.id}
                          onBlur={(e) => {
                            if (Number(e.target.value) !== rate[field]) saveField(rate, field, e.target.value);
                          }}
                          className="h-7 w-28 text-xs"
                        />
                      ) : (
                        <span className="text-xs">{rate[field].toLocaleString("hu-HU")}</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {rates.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nincs betöltött ártétel
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
