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
  RoughEstimateSettings,
  User,
  WALL_TYPE_LABELS,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function variantLabel(rate: RoughEstimateRate): string {
  if (rate.wall_type) return WALL_TYPE_LABELS[rate.wall_type] ?? rate.wall_type;
  if (rate.roof_covering_type) return ROOF_COVERING_LABELS[rate.roof_covering_type] ?? rate.roof_covering_type;
  if (rate.foundation_type) return FOUNDATION_TYPE_LABELS[rate.foundation_type] ?? rate.foundation_type;
  return "—";
}

function formatHuf(value: number): string {
  return `${Math.round(value).toLocaleString("hu-HU")} Ft`;
}

export default function CostEstimateRatesPage() {
  const [rates, setRates] = useState<RoughEstimateRate[]>([]);
  const [settings, setSettings] = useState<RoughEstimateSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({ economy_adjustment_pct: "0", premium_adjustment_pct: "0" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [savingId, setSavingId] = useState<number | null>(null);

  function load() {
    api.costEstimateRates().then(setRates).catch(() => setRates([]));
    api.costEstimateSettings().then((s) => {
      setSettings(s);
      setSettingsForm({
        economy_adjustment_pct: String(s.economy_adjustment_pct),
        premium_adjustment_pct: String(s.premium_adjustment_pct),
      });
    }).catch(() => setSettings(null));
  }

  useEffect(() => {
    load();
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "billing";

  async function saveBasePrice(rate: RoughEstimateRate, value: string) {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    setSavingId(rate.id);
    try {
      const updated = await api.updateCostEstimateRate(rate.id, { base_price: num });
      setRates((prev) => prev.map((r) => (r.id === rate.id ? updated : r)));
      toast.success("Ár mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSavingId(null);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        "A globális százalék módosítása azonnal újraszámolja az összes gazdaságos/prémium árat. Biztosan mented?"
      )
    ) {
      return;
    }
    setSavingSettings(true);
    try {
      const updated = await api.updateCostEstimateSettings({
        economy_adjustment_pct: Number(settingsForm.economy_adjustment_pct) || 0,
        premium_adjustment_pct: Number(settingsForm.premium_adjustment_pct) || 0,
      });
      setSettings(updated);
      toast.success("Beállítások mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSavingSettings(false);
    }
  }

  const economyPct = settings?.economy_adjustment_pct ?? 0;
  const premiumPct = settings?.premium_adjustment_pct ?? 0;

  const grouped = rates.reduce<Record<string, RoughEstimateRate[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="mb-3">
        <h1 className="text-lg font-heading font-bold text-foreground">Költségbecslés ártábla</h1>
        <p className="text-xs text-muted-foreground">
          A projekt fülön elérhető gyorsbecslés (m²/fm-alapú, nagyságrendi) kategóriánkénti Ft alapárai.
          A gazdaságos/prémium ár a lenti globális százalékkal számítódik az alapárból — nem soronként
          állítható. A kezdeti értékek tájékoztató jellegűek — kalibráld a valós piaci árakra.
        </p>
      </div>

      <Card className="mb-3 p-3">
        <h3 className="mb-2 text-[13px] font-semibold">Kivitelezési szint — globális szorzó</h3>
        <form onSubmit={saveSettings} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ces-economy">Gazdaságos (%)</Label>
            <Input
              id="ces-economy"
              type="number"
              step="1"
              min="-90"
              max="200"
              disabled={!canEdit}
              value={settingsForm.economy_adjustment_pct}
              onChange={(e) => setSettingsForm({ ...settingsForm, economy_adjustment_pct: e.target.value })}
              className="h-8 w-28 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ces-premium">Prémium (%)</Label>
            <Input
              id="ces-premium"
              type="number"
              step="1"
              min="-90"
              max="200"
              disabled={!canEdit}
              value={settingsForm.premium_adjustment_pct}
              onChange={(e) => setSettingsForm({ ...settingsForm, premium_adjustment_pct: e.target.value })}
              className="h-8 w-28 text-xs"
            />
          </div>
          {canEdit && (
            <Button type="submit" size="sm" disabled={savingSettings}>
              {savingSettings ? "Mentés..." : "Mentés"}
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">
            Standard = alapár. Gazdaságos = alapár × (1 {economyPct >= 0 ? "+" : ""}{economyPct}%). Prémium =
            alapár × (1 {premiumPct >= 0 ? "+" : ""}{premiumPct}%).
          </p>
        </form>
      </Card>

      <Card
        className="overflow-x-auto py-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--card) 0%, transparent 24px), linear-gradient(to left, var(--card) 0%, transparent 24px), linear-gradient(to right, rgba(0,0,0,0.18), transparent 10px), linear-gradient(to left, rgba(0,0,0,0.18), transparent 10px)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "24px 100%, 24px 100%, 10px 100%, 10px 100%",
          backgroundPosition: "0 0, 100% 0, 0 0, 100% 0",
          backgroundAttachment: "local, local, scroll, scroll",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategória</TableHead>
              <TableHead>Variáns</TableHead>
              <TableHead>Mértékegység</TableHead>
              <TableHead>Alapár / Standard (Ft)</TableHead>
              <TableHead>Gazdaságos (Ft)</TableHead>
              <TableHead>Prémium (Ft)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(grouped).map(([category, rows], groupIdx) =>
              rows.map((rate, idx) => (
                <TableRow
                  key={rate.id}
                  className={idx === 0 && groupIdx > 0 ? "border-t-2 border-t-border" : undefined}
                >
                  <TableCell className="text-xs font-medium">
                    {idx === 0 ? (ROUGH_ESTIMATE_CATEGORY_LABELS[category] ?? category) : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{variantLabel(rate)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{rate.unit_label}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        defaultValue={rate.base_price}
                        disabled={savingId === rate.id}
                        onBlur={(e) => {
                          if (Number(e.target.value) !== rate.base_price) saveBasePrice(rate, e.target.value);
                        }}
                        className="h-7 w-28 text-xs"
                      />
                    ) : (
                      <span className="text-xs">{formatHuf(rate.base_price)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatHuf(rate.base_price * (1 + economyPct / 100))}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatHuf(rate.base_price * (1 + premiumPct / 100))}
                  </TableCell>
                </TableRow>
              ))
            )}
            {rates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
