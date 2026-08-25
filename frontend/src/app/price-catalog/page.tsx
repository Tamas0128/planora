"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  api,
  getCachedUser,
  PRICE_CATALOG_SOURCE_LABELS,
  PriceCatalogItem,
  User,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatHuf(value?: string): string {
  if (value === undefined || value === null || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toLocaleString("hu-HU")} Ft` : value;
}

const emptyForm = {
  code: "",
  description: "",
  unit: "",
  chapter: "",
  unit_price_material: "0",
  unit_price_labor: "0",
  source_reference: "",
};

type ItemForm = typeof emptyForm;

function toForm(item: PriceCatalogItem): ItemForm {
  return {
    code: item.code,
    description: item.description,
    unit: item.unit,
    chapter: item.chapter,
    unit_price_material: item.unit_price_material,
    unit_price_labor: item.unit_price_labor,
    source_reference: item.source_reference ?? "",
  };
}

export default function PriceCatalogPage() {
  const [items, setItems] = useState<PriceCatalogItem[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [chapterFilter, setChapterFilter] = useState<string>("all");
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm);

  function load() {
    api
      .priceCatalogItems({
        search: search || undefined,
        chapter: chapterFilter === "all" ? undefined : chapterFilter,
        active_only: false,
      })
      .then(setItems)
      .catch(() => setItems([]));
  }

  useEffect(() => {
    api.priceCatalogChapters().then(setChapters).catch(() => setChapters([]));
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, chapterFilter]);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "billing";

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(item: PriceCatalogItem) {
    setEditingId(item.id);
    setForm(toForm(item));
    setShowDialog(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        description: form.description.trim(),
        unit: form.unit.trim(),
        chapter: form.chapter.trim(),
        unit_price_material: Number(form.unit_price_material) || 0,
        unit_price_labor: Number(form.unit_price_labor) || 0,
        source_reference: form.source_reference.trim() || undefined,
      };
      if (editingId) {
        const updated = await api.updatePriceCatalogItem(editingId, payload);
        setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await api.createPriceCatalogItem(payload);
        setItems((prev) => [created, ...prev]);
      }
      setShowDialog(false);
      toast.success(editingId ? "Tétel mentve" : "Tétel létrehozva");
      api.priceCatalogChapters().then(setChapters).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: PriceCatalogItem) {
    try {
      const updated = await api.updatePriceCatalogItem(item.id, { is_active: !item.is_active });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function handleDelete(item: PriceCatalogItem) {
    try {
      await api.deletePriceCatalogItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Tétel törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Tételes ártábla</h1>
          <p className="text-xs text-muted-foreground">
            A tervezett tételes (TERC-alapú) költségvetés majdani sorforrása — kód, megnevezés,
            mennyiségi egység, anyag/díj egységár, munkanem szerint csoportosítva.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" /> Új tétel
          </Button>
        )}
      </div>

      <div className="mb-3 flex gap-2">
        <Input
          placeholder="Keresés kód vagy megnevezés alapján..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={chapterFilter} onValueChange={(v) => setChapterFilter(v ?? "all")}>
          <SelectTrigger className="w-64">
            <SelectValue>{(v: string) => (v === "all" ? "Összes munkanem" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes munkanem</SelectItem>
            {chapters.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kód</TableHead>
              <TableHead>Megnevezés</TableHead>
              <TableHead>Munkanem</TableHead>
              <TableHead>Egység</TableHead>
              <TableHead>Anyag (Ft)</TableHead>
              <TableHead>Díj (Ft)</TableHead>
              <TableHead>Összesen (Ft)</TableHead>
              <TableHead>Forrás</TableHead>
              <TableHead>Aktív</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs font-medium">{item.code}</TableCell>
                <TableCell className="text-xs">{item.description}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.chapter}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                <TableCell className="text-xs">{formatHuf(item.unit_price_material)}</TableCell>
                <TableCell className="text-xs">{formatHuf(item.unit_price_labor)}</TableCell>
                <TableCell className="text-xs font-medium">{formatHuf(item.unit_price_total)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {PRICE_CATALOG_SOURCE_LABELS[item.source] ?? item.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  {canEdit ? (
                    <Checkbox checked={item.is_active} aria-label="Aktív" onCheckedChange={() => toggleActive(item)} />
                  ) : (
                    <Badge variant={item.is_active ? "default" : "outline"} className="text-xs">
                      {item.is_active ? "Aktív" : "Inaktív"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(item)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 hover:text-destructive"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                  Nincs a szűrésnek megfelelő tétel
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Tétel szerkesztése" : "Új tétel"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pc-code">Kód</Label>
                  <Input id="pc-code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pc-unit">Mennyiségi egység</Label>
                  <Input id="pc-unit" required placeholder="pl. m2, fm, db" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-description">Megnevezés</Label>
                <Input id="pc-description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-chapter">Munkanem</Label>
                <Input id="pc-chapter" required placeholder="pl. Földmunka, Alapozás, Falazás" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pc-material">Anyag egységár (Ft)</Label>
                  <Input id="pc-material" type="number" min="0" step="1" value={form.unit_price_material} onChange={(e) => setForm({ ...form, unit_price_material: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pc-labor">Díj egységár (Ft)</Label>
                  <Input id="pc-labor" type="number" min="0" step="1" value={form.unit_price_labor} onChange={(e) => setForm({ ...form, unit_price_labor: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-source-ref">Forrás hivatkozás</Label>
                <Input id="pc-source-ref" placeholder="pl. saját kalkuláció, ajánlat alapján" value={form.source_reference} onChange={(e) => setForm({ ...form, source_reference: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || !form.code || !form.description}>
                {saving ? "Mentés..." : "Mentés"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
