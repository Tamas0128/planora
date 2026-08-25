"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  CostEstimateRough,
  FOUNDATION_TYPE_LABELS,
  FinishLevel,
  FoundationType,
  ROOF_COVERING_LABELS,
  ROUGH_ESTIMATE_CATEGORY_LABELS,
  RoofCoveringType,
  WALL_TYPE_LABELS,
  WallType,
  FINISH_LEVEL_LABELS,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const FINISH_LEVEL_OPTIONS = Object.entries(FINISH_LEVEL_LABELS) as [string, string][];
const WALL_TYPE_OPTIONS = Object.entries(WALL_TYPE_LABELS) as [string, string][];
const ROOF_COVERING_OPTIONS = Object.entries(ROOF_COVERING_LABELS) as [string, string][];
const FOUNDATION_TYPE_OPTIONS = Object.entries(FOUNDATION_TYPE_LABELS) as [string, string][];

function formatHuf(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("hu-HU")} Ft`;
}

interface FormState {
  finish_level: FinishLevel;
  floor_area_sqm: string;
  exterior_wall_fm: string;
  exterior_wall_type: WallType;
  interior_wall_fm: string;
  interior_wall_type: WallType;
  has_basement: boolean;
  basement_wall_fm: string;
  walkable_slab_sqm: string;
  light_slab_sqm: string;
  roof_area_sqm: string;
  roof_covering_type: RoofCoveringType;
  foundation_type: FoundationType;
  notes: string;
}

function emptyForm(defaultFloorAreaSqm?: number): FormState {
  return {
    finish_level: "standard",
    floor_area_sqm: defaultFloorAreaSqm ? String(defaultFloorAreaSqm) : "",
    exterior_wall_fm: "",
    exterior_wall_type: "light_steel",
    interior_wall_fm: "",
    interior_wall_type: "light_steel",
    has_basement: false,
    basement_wall_fm: "",
    walkable_slab_sqm: "",
    light_slab_sqm: "",
    roof_area_sqm: "",
    roof_covering_type: "tile",
    foundation_type: "strip",
    notes: "",
  };
}

export default function CostEstimateRoughTab({
  projectId,
  defaultFloorAreaSqm,
  canEdit,
}: {
  projectId: number;
  defaultFloorAreaSqm?: number;
  canEdit: boolean;
}) {
  const [estimates, setEstimates] = useState<CostEstimateRough[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultFloorAreaSqm));
  const [calculating, setCalculating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .roughEstimates(projectId)
      .then((rows) => {
        setEstimates(rows);
        if (rows.length > 0) setExpandedId(rows[0].id);
      })
      .catch(() => setEstimates([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setCalculating(true);
    try {
      const payload = {
        finish_level: form.finish_level,
        floor_area_sqm: Number(form.floor_area_sqm) || 0,
        exterior_wall_fm: Number(form.exterior_wall_fm) || 0,
        exterior_wall_type: form.exterior_wall_type,
        interior_wall_fm: Number(form.interior_wall_fm) || 0,
        interior_wall_type: form.interior_wall_type,
        has_basement: form.has_basement,
        basement_wall_fm: form.has_basement ? Number(form.basement_wall_fm) || 0 : 0,
        walkable_slab_sqm: Number(form.walkable_slab_sqm) || 0,
        light_slab_sqm: Number(form.light_slab_sqm) || 0,
        roof_area_sqm: Number(form.roof_area_sqm) || 0,
        roof_covering_type: form.roof_covering_type,
        foundation_type: form.foundation_type,
        notes: form.notes.trim() || undefined,
      };
      const created = await api.createRoughEstimate(projectId, payload);
      setEstimates((prev) => [created, ...prev]);
      setExpandedId(created.id);
      toast.success("Költségbecslés elkészült");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a becslés számítása során");
    } finally {
      setCalculating(false);
    }
  }

  async function handleDelete(estimateId: number) {
    try {
      await api.deleteRoughEstimate(projectId, estimateId);
      setEstimates((prev) => prev.filter((e) => e.id !== estimateId));
      toast.success("Becslés törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card className="p-3">
          <h3 className="mb-3 text-[13px] font-semibold">Új gyorsbecslés</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Nagyságrendi, ±15%-os sávban megadott költségbecslés az alábbi paraméterek alapján — nem
            helyettesíti a tételes költségvetést.
          </p>
          <form onSubmit={handleCalculate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Kivitelezési szint</Label>
                <Select
                  value={form.finish_level}
                  onValueChange={(v) => setForm({ ...form, finish_level: v as FinishLevel })}
                >
                  <SelectTrigger><SelectValue>{(v: string) => FINISH_LEVEL_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {FINISH_LEVEL_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-floor-area">Alapterület (m²)</Label>
                <Input
                  id="ce-floor-area"
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  value={form.floor_area_sqm}
                  onChange={(e) => setForm({ ...form, floor_area_sqm: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Alapozás típusa</Label>
                <Select
                  value={form.foundation_type}
                  onValueChange={(v) => setForm({ ...form, foundation_type: v as FoundationType })}
                >
                  <SelectTrigger><SelectValue>{(v: string) => FOUNDATION_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {FOUNDATION_TYPE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="ce-ext-wall-fm">Külső fal (fm)</Label>
                <Input
                  id="ce-ext-wall-fm"
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  value={form.exterior_wall_fm}
                  onChange={(e) => setForm({ ...form, exterior_wall_fm: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Külső fal típusa</Label>
                <Select
                  value={form.exterior_wall_type}
                  onValueChange={(v) => setForm({ ...form, exterior_wall_type: v as WallType })}
                >
                  <SelectTrigger><SelectValue>{(v: string) => WALL_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {WALL_TYPE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-int-wall-fm">Belső válaszfal (fm)</Label>
                <Input
                  id="ce-int-wall-fm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.interior_wall_fm}
                  onChange={(e) => setForm({ ...form, interior_wall_fm: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Belső válaszfal típusa</Label>
                <Select
                  value={form.interior_wall_type}
                  onValueChange={(v) => setForm({ ...form, interior_wall_type: v as WallType })}
                >
                  <SelectTrigger><SelectValue>{(v: string) => WALL_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {WALL_TYPE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="ce-has-basement"
                checked={form.has_basement}
                onCheckedChange={(checked) => setForm({ ...form, has_basement: checked === true })}
              />
              <Label htmlFor="ce-has-basement" className="font-normal">Van pinceszint</Label>
            </div>
            {form.has_basement && (
              <div className="max-w-xs space-y-1.5">
                <Label htmlFor="ce-basement-wall-fm">Pincefal (fm)</Label>
                <Input
                  id="ce-basement-wall-fm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.basement_wall_fm}
                  onChange={(e) => setForm({ ...form, basement_wall_fm: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="ce-walkable-slab">Járható födém (m²)</Label>
                <Input
                  id="ce-walkable-slab"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.walkable_slab_sqm}
                  onChange={(e) => setForm({ ...form, walkable_slab_sqm: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-light-slab">Könnyű födém (m²)</Label>
                <Input
                  id="ce-light-slab"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.light_slab_sqm}
                  onChange={(e) => setForm({ ...form, light_slab_sqm: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-roof-area">Tetőfelület (m²)</Label>
                <Input
                  id="ce-roof-area"
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  value={form.roof_area_sqm}
                  onChange={(e) => setForm({ ...form, roof_area_sqm: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tetőhéjazat típusa</Label>
                <Select
                  value={form.roof_covering_type}
                  onValueChange={(v) => setForm({ ...form, roof_covering_type: v as RoofCoveringType })}
                >
                  <SelectTrigger><SelectValue>{(v: string) => ROOF_COVERING_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {ROOF_COVERING_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ce-notes">Megjegyzés</Label>
              <Textarea
                id="ce-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <Button type="submit" disabled={calculating}>
              {calculating ? "Számítás..." : "Becslés készítése"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="p-3">
        <h3 className="mb-2 text-[13px] font-semibold">Korábbi becslések</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">Betöltés...</p>
        ) : estimates.length === 0 ? (
          <p className="text-xs text-muted-foreground">Még nincs mentett költségbecslés.</p>
        ) : (
          <div className="space-y-2">
            {estimates.map((est) => {
              const expanded = expandedId === est.id;
              return (
                <div key={est.id} className="rounded border border-border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                    onClick={() => setExpandedId(expanded ? null : est.id)}
                  >
                    <span className="flex items-center gap-2 text-xs">
                      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      <span className="font-medium">
                        {new Date(est.created_at).toLocaleString("hu-HU")}
                      </span>
                      <span className="text-muted-foreground">
                        {FINISH_LEVEL_LABELS[est.finish_level] ?? est.finish_level} · {est.floor_area_sqm} m²
                      </span>
                      {est.created_by_name && (
                        <span className="text-muted-foreground">· {est.created_by_name}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs font-semibold">
                        {formatHuf(est.total_net_min)} – {formatHuf(est.total_net_max)}
                      </span>
                      {canEdit && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(est.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </span>
                      )}
                    </span>
                  </button>
                  {expanded && (
                    <div className="border-t border-border px-3 py-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kategória</TableHead>
                            <TableHead>Mennyiség</TableHead>
                            <TableHead>Egységár</TableHead>
                            <TableHead>Sorösszeg</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {est.breakdown.map((line, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs">
                                {ROUGH_ESTIMATE_CATEGORY_LABELS[line.category] ?? line.category}
                                {line.wall_type && ` (${WALL_TYPE_LABELS[line.wall_type] ?? line.wall_type})`}
                                {line.roof_covering_type &&
                                  ` (${ROOF_COVERING_LABELS[line.roof_covering_type] ?? line.roof_covering_type})`}
                              </TableCell>
                              <TableCell className="text-xs">{line.quantity}</TableCell>
                              <TableCell className="text-xs">{formatHuf(line.unit_price)}</TableCell>
                              <TableCell className="text-xs font-medium">{formatHuf(line.line_total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {est.notes && (
                        <p className="mt-2 text-xs text-muted-foreground">Megjegyzés: {est.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
