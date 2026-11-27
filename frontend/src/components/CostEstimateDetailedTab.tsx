"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileOutput, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  CostEstimateDetailed,
  CostEstimateDetailedSummary,
  PriceCatalogItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function formatHuf(value?: string): string {
  if (value === undefined || value === null || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toLocaleString("hu-HU")} Ft` : value;
}

const emptyManualForm = { description: "", unit: "", chapter: "", quantity: "1", unit_price_material: "0", unit_price_labor: "0" };

export default function CostEstimateDetailedTab({
  projectId,
  hasCustomer,
  canEdit,
}: {
  projectId: number;
  hasCustomer: boolean;
  canEdit: boolean;
}) {
  const [summaries, setSummaries] = useState<CostEstimateDetailedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CostEstimateDetailed | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<PriceCatalogItem[]>([]);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [showManualForm, setShowManualForm] = useState(false);

  function loadSummaries() {
    setLoading(true);
    api
      .detailedEstimates(projectId)
      .then(setSummaries)
      .catch(() => setSummaries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!selected) return;
    const t = setTimeout(() => {
      if (catalogSearch.trim().length < 2) {
        setCatalogResults([]);
        return;
      }
      api
        .priceCatalogItems({ search: catalogSearch, active_only: true })
        .then(setCatalogResults)
        .catch(() => setCatalogResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [catalogSearch, selected]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api.createDetailedEstimate(projectId, {
        name: createForm.name.trim(),
        notes: createForm.notes.trim() || undefined,
      });
      setShowCreateDialog(false);
      setCreateForm({ name: "", notes: "" });
      setSelected(created);
      loadSummaries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreating(false);
    }
  }

  async function openEstimate(id: number) {
    try {
      const full = await api.getDetailedEstimate(projectId, id);
      setSelected(full);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a megnyitás során");
    }
  }

  async function handleDeleteEstimate(id: number) {
    try {
      await api.deleteDetailedEstimate(projectId, id);
      setSummaries((prev) => prev.filter((s) => s.id !== id));
      toast.success("Költségvetés törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function addFromCatalog(item: PriceCatalogItem) {
    if (!selected) return;
    try {
      const updated = await api.addDetailedEstimateItem(projectId, selected.id, {
        catalog_item_id: item.id,
        quantity: 1,
      });
      setSelected(updated);
      setCatalogSearch("");
      setCatalogResults([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a tétel hozzáadása során");
    }
  }

  async function addManualItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      const updated = await api.addDetailedEstimateItem(projectId, selected.id, {
        description: manualForm.description.trim(),
        unit: manualForm.unit.trim(),
        chapter: manualForm.chapter.trim(),
        quantity: Number(manualForm.quantity) || 0,
        unit_price_material: Number(manualForm.unit_price_material) || 0,
        unit_price_labor: Number(manualForm.unit_price_labor) || 0,
      });
      setSelected(updated);
      setManualForm(emptyManualForm);
      setShowManualForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a tétel hozzáadása során");
    }
  }

  async function patchItem(itemId: number, field: string, value: string) {
    if (!selected) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    try {
      const updated = await api.updateDetailedEstimateItem(projectId, selected.id, itemId, {
        [field]: num,
      });
      setSelected(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function removeItem(itemId: number) {
    if (!selected) return;
    try {
      const updated = await api.deleteDetailedEstimateItem(projectId, selected.id, itemId);
      setSelected(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function handleTransfer() {
    if (!selected) return;
    setTransferring(true);
    try {
      const result = await api.transferDetailedEstimateToQuote(projectId, selected.id);
      toast.success(`Ajánlat létrehozva: ${result.quote_number}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az ajánlatba vitel során");
    } finally {
      setTransferring(false);
    }
  }

  async function handleExport() {
    if (!selected) return;
    setExporting(true);
    try {
      await api.exportDetailedEstimateXlsx(projectId, selected.id, `koltsegvetes_${selected.id}.xlsx`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az exportálás során");
    } finally {
      setExporting(false);
    }
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(null);
              loadSummaries();
            }}
          >
            <ArrowLeft className="size-3.5" /> Vissza a listához
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || selected.items.length === 0}>
              <Download className="size-3.5" /> {exporting ? "Exportálás..." : "Export XLSX"}
            </Button>
            {canEdit && (
              <Button
                size="sm"
                onClick={handleTransfer}
                disabled={transferring || selected.items.length === 0 || !hasCustomer}
                title={!hasCustomer ? "A projekthez nincs ügyfél rendelve" : undefined}
              >
                <FileOutput className="size-3.5" /> {transferring ? "Átvitel..." : "Átvitel ajánlatba"}
              </Button>
            )}
          </div>
        </div>

        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">{selected.name}</h3>
            <span className="text-sm font-bold">{formatHuf(selected.grand_total)}</span>
          </div>
          {selected.notes && <p className="mb-2 text-xs text-muted-foreground">{selected.notes}</p>}
          {!hasCustomer && (
            <p className="mb-2 text-xs text-warning-foreground">
              A projekthez nincs ügyfél rendelve — az ajánlatba vitel csak ügyféllel rendelkező projektnél elérhető.
            </p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kód</TableHead>
                <TableHead>Megnevezés</TableHead>
                <TableHead>Munkanem</TableHead>
                <TableHead>Egység</TableHead>
                <TableHead>Menny.</TableHead>
                <TableHead>Anyag (Ft)</TableHead>
                <TableHead>Díj (Ft)</TableHead>
                <TableHead>Sorösszeg (Ft)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selected.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs text-muted-foreground">{item.code || "—"}</TableCell>
                  <TableCell className="text-xs">{item.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.chapter}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        defaultValue={item.quantity}
                        className="h-7 w-20 text-xs"
                        onBlur={(e) => e.target.value !== item.quantity && patchItem(item.id, "quantity", e.target.value)}
                      />
                    ) : (
                      <span className="text-xs">{item.quantity}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={item.unit_price_material}
                        className="h-7 w-24 text-xs"
                        onBlur={(e) =>
                          e.target.value !== item.unit_price_material &&
                          patchItem(item.id, "unit_price_material", e.target.value)
                        }
                      />
                    ) : (
                      <span className="text-xs">{formatHuf(item.unit_price_material)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={item.unit_price_labor}
                        className="h-7 w-24 text-xs"
                        onBlur={(e) =>
                          e.target.value !== item.unit_price_labor &&
                          patchItem(item.id, "unit_price_labor", e.target.value)
                        }
                      />
                    ) : (
                      <span className="text-xs">{formatHuf(item.unit_price_labor)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{formatHuf(item.line_total)}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => removeItem(item.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {selected.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    Még nincs tétel — adj hozzá a katalógusból vagy egyedi sorként.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {selected.chapter_subtotals.length > 1 && (
            <div className="mt-3 grid grid-cols-2 gap-1 border-t border-border pt-2 text-xs sm:grid-cols-4">
              {selected.chapter_subtotals.map((cs) => (
                <div key={cs.chapter} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{cs.chapter}</span>
                  <span className="font-medium">{formatHuf(cs.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {canEdit && (
          <Card className="p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tétel hozzáadása a katalógusból
            </h4>
            <Input
              placeholder="Keresés kód vagy megnevezés alapján..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="max-w-sm"
            />
            {catalogResults.length > 0 && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded border border-border">
                {catalogResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-muted"
                    onClick={() => addFromCatalog(r)}
                  >
                    <span>
                      <span className="text-muted-foreground">{r.code}</span> — {r.description}{" "}
                      <span className="text-muted-foreground">({r.unit})</span>
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      {formatHuf(r.unit_price_total)} <Plus className="size-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 border-t border-border pt-3">
              {!showManualForm ? (
                <Button variant="outline" size="sm" onClick={() => setShowManualForm(true)}>
                  <Plus className="size-3.5" /> Egyedi tétel hozzáadása
                </Button>
              ) : (
                <form onSubmit={addManualItem} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <Input
                    placeholder="Megnevezés"
                    required
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    className="col-span-2"
                  />
                  <Input
                    placeholder="Munkanem"
                    required
                    value={manualForm.chapter}
                    onChange={(e) => setManualForm({ ...manualForm, chapter: e.target.value })}
                  />
                  <Input
                    placeholder="Egység"
                    required
                    value={manualForm.unit}
                    onChange={(e) => setManualForm({ ...manualForm, unit: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Menny."
                    value={manualForm.quantity}
                    onChange={(e) => setManualForm({ ...manualForm, quantity: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Anyag (Ft)"
                    value={manualForm.unit_price_material}
                    onChange={(e) => setManualForm({ ...manualForm, unit_price_material: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Díj (Ft)"
                    value={manualForm.unit_price_labor}
                    onChange={(e) => setManualForm({ ...manualForm, unit_price_labor: e.target.value })}
                  />
                  <div className="col-span-2 flex gap-2 sm:col-span-6">
                    <Button type="submit" size="sm">Hozzáadás</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>
                      Mégse
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Tételes, katalógus-alapú költségvetés a projekthez — a tételek átvihetők az ügyfél ajánlatába.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="size-3.5" /> Új tételes költségvetés
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Név</TableHead>
              <TableHead>Összeg</TableHead>
              <TableHead>Létrehozta</TableHead>
              <TableHead>Dátum</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => openEstimate(s.id)}>
                <TableCell className="text-xs font-medium">{s.name}</TableCell>
                <TableCell className="text-xs font-semibold">{formatHuf(s.grand_total)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.created_by_name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString("hu-HU")}
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEstimate(s.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && summaries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Még nincs tételes költségvetés ehhez a projekthez.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Új tételes költségvetés</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="ced-name">Név</Label>
                <Input
                  id="ced-name"
                  required
                  placeholder="pl. v1, 2026-08 ajánlat"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ced-notes">Megjegyzés</Label>
                <Textarea
                  id="ced-notes"
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating || !createForm.name.trim()}>
                {creating ? "Létrehozás..." : "Létrehozás"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
