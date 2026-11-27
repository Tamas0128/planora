"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, TradeItem, TradeItemInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function emptyForm(): TradeItemInput {
  return {
    name: "",
    contractor: "",
    info: "",
    offer_status: "",
    contract_status: "",
    material_status: "",
    expected_timing: "",
    tig: "",
    cross_trade_note: "",
    extra_work_note: "",
  };
}

export default function TradeItemsTab({ projectId, canEdit }: { projectId: number; canEdit: boolean }) {
  const [items, setItems] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TradeItemInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [parsedRows, setParsedRows] = useState<TradeItemInput[] | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    return api
      .tradeItems(projectId)
      .then(setItems)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Hiba a betöltés során"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function startEdit(item: TradeItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      contractor: item.contractor ?? "",
      info: item.info ?? "",
      offer_status: item.offer_status ?? "",
      contract_status: item.contract_status ?? "",
      material_status: item.material_status ?? "",
      expected_timing: item.expected_timing ?? "",
      tig: item.tig ?? "",
      cross_trade_note: item.cross_trade_note ?? "",
      extra_work_note: item.extra_work_note ?? "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("A megnevezés kötelező");
      return;
    }
    setSaving(true);
    try {
      if (editingId != null) {
        const updated = await api.updateTradeItem(projectId, editingId, form);
        setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await api.createTradeItem(projectId, form);
        setItems((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Biztosan törlöd ezt a tételt?")) return;
    try {
      await api.deleteTradeItem(projectId, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function handleMove(item: TradeItem, direction: -1 | 1) {
    const idx = items.findIndex((i) => i.id === item.id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const reordered = [...items];
    reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, item);
    setItems(reordered);
    try {
      await api.updateTradeItem(projectId, item.id, { sort_order: targetIdx });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az átrendezés során");
      load();
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setImporting(true);
    setParsedRows(null);
    try {
      const result = await api.parseTradeItemsImport(projectId, file);
      setParsedRows(result.rows);
      setParseWarnings(result.warnings);
      if (result.rows.length === 0) {
        toast.error("Nem találtam tételt ebben a fájlban");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az importálás során");
    } finally {
      setImporting(false);
    }
  }

  async function handleCommitImport() {
    if (!parsedRows || parsedRows.length === 0) return;
    setCommitting(true);
    try {
      const created = await api.commitTradeItemsImport(projectId, parsedRows);
      setItems((prev) => [...prev, ...created]);
      toast.success(`${created.length} tétel importálva`);
      setShowImport(false);
      setParsedRows(null);
      setParseWarnings([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az importálás során");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Munkanemenkénti alvállalkozó-, ajánlat- és szerződés-állapot ("ki miben tart") — a helyszíni Excel-táblák mintájára.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowImport(true)} className="h-8 gap-1.5 text-[13px] font-semibold">
              <Upload className="size-3.5" /> Excel import
            </Button>
            <Button size="sm" onClick={startCreate} className="h-8 gap-1.5 text-[13px] font-semibold">
              <Plus className="size-3.5" /> Új tétel
            </Button>
          </div>
        )}
      </div>

      <Card className="overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Betöltés…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Még nincs felvéve munkanem-tétel.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Megnevezés</TableHead>
                <TableHead>Ubr./Alváll.</TableHead>
                <TableHead>Ajánlat</TableHead>
                <TableHead>Szerződés</TableHead>
                <TableHead>Alapanyag</TableHead>
                <TableHead>Várható idő</TableHead>
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => {
                const expanded = expandedId === item.id;
                const hasDetail = Boolean(item.info || item.tig || item.cross_trade_note || item.extra_work_note);
                return (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell>
                        {hasDetail && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.contractor || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={item.offer_status ?? undefined}>
                        {item.offer_status || "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate" title={item.contract_status ?? undefined}>
                        {item.contract_status || "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={item.material_status ?? undefined}>
                        {item.material_status || "—"}
                      </TableCell>
                      <TableCell>{item.expected_timing || "—"}</TableCell>
                      {canEdit && (
                        <TableCell className="whitespace-nowrap text-right">
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => handleMove(item, -1)} disabled={idx === 0}>
                            ↑
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => handleMove(item, 1)} disabled={idx === items.length - 1}>
                            ↓
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => startEdit(item)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={canEdit ? 7 : 6} className="bg-muted/30 text-sm">
                          <div className="grid gap-2 py-1 sm:grid-cols-2">
                            {item.info && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Infó</p>
                                <p className="whitespace-pre-wrap">{item.info}</p>
                              </div>
                            )}
                            {item.tig && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">TIG</p>
                                <p className="whitespace-pre-wrap">{item.tig}</p>
                              </div>
                            )}
                            {item.cross_trade_note && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Más szakágat érint</p>
                                <p className="whitespace-pre-wrap">{item.cross_trade_note}</p>
                              </div>
                            )}
                            {item.extra_work_note && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Pótmunka</p>
                                <p className="whitespace-pre-wrap">{item.extra_work_note}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId != null ? "Tétel szerkesztése" : "Új munkanem-tétel"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="ti-name">Megnevezés</Label>
                <Input id="ti-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-contractor">Ubr./Alváll.</Label>
                <Input id="ti-contractor" value={form.contractor ?? ""} onChange={(e) => setForm({ ...form, contractor: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-info">Infó</Label>
                <Textarea id="ti-info" value={form.info ?? ""} onChange={(e) => setForm({ ...form, info: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ti-offer">Ajánlatkérés</Label>
                  <Input id="ti-offer" value={form.offer_status ?? ""} onChange={(e) => setForm({ ...form, offer_status: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ti-contract">Alvállalkozói szerződés</Label>
                  <Input id="ti-contract" value={form.contract_status ?? ""} onChange={(e) => setForm({ ...form, contract_status: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ti-material">Alapanyag</Label>
                  <Input id="ti-material" value={form.material_status ?? ""} onChange={(e) => setForm({ ...form, material_status: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ti-timing">Kivitelezés várható ideje</Label>
                  <Input id="ti-timing" value={form.expected_timing ?? ""} onChange={(e) => setForm({ ...form, expected_timing: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-tig">TIG</Label>
                <Input id="ti-tig" value={form.tig ?? ""} onChange={(e) => setForm({ ...form, tig: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-cross">Extra, ami más szakágat is befolyásol</Label>
                <Textarea id="ti-cross" value={form.cross_trade_note ?? ""} onChange={(e) => setForm({ ...form, cross_trade_note: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-extra">Pótmunka</Label>
                <Textarea id="ti-extra" value={form.extra_work_note ?? ""} onChange={(e) => setForm({ ...form, extra_work_note: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Mentés…" : "Mentés"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showImport}
        onOpenChange={(open) => {
          setShowImport(open);
          if (!open) {
            setParsedRows(null);
            setParseWarnings([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Munkanem-táblázat Excel import</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Tölts fel egy munkanemenkénti állapot-táblázatot (pl. "ütem+info" jellegű lapot). A rendszer megpróbálja
              felismerni az oszlopokat — az eredményt importálás előtt átnézheted.
            </p>
            <Input ref={fileInputRef} type="file" accept=".xlsx,.xlsm" onChange={handleFileSelected} disabled={importing} />
            {importing && <p className="text-sm text-muted-foreground">Feldolgozás…</p>}
            {parseWarnings.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-700">
                {parseWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {parsedRows && parsedRows.length > 0 && (
              <div className="max-h-80 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Megnevezés</TableHead>
                      <TableHead>Ubr./Alváll.</TableHead>
                      <TableHead>Ajánlat</TableHead>
                      <TableHead>Szerződés</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.contractor || "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{row.offer_status || "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{row.contract_status || "—"}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => setParsedRows((prev) => (prev ? prev.filter((_, j) => j !== i) : prev))}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCommitImport} disabled={!parsedRows || parsedRows.length === 0 || committing}>
              {committing ? "Importálás…" : `Importálás (${parsedRows?.length ?? 0} sor)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
