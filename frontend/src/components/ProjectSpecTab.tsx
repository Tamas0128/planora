"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, ProjectSpecItem, ProjectSpecItemInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function emptyForm(groupName = ""): ProjectSpecItemInput {
  return { group_name: groupName, label: "", value: "", note: "" };
}

function groupItems(items: ProjectSpecItem[]): [string, ProjectSpecItem[]][] {
  const order: string[] = [];
  const byGroup = new Map<string, ProjectSpecItem[]>();
  for (const item of items) {
    if (!byGroup.has(item.group_name)) {
      byGroup.set(item.group_name, []);
      order.push(item.group_name);
    }
    byGroup.get(item.group_name)!.push(item);
  }
  return order.map((name) => [name, byGroup.get(name)!]);
}

export default function ProjectSpecTab({ projectId, canEdit }: { projectId: number; canEdit: boolean }) {
  const [items, setItems] = useState<ProjectSpecItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectSpecItemInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ProjectSpecItemInput[] | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    return api
      .specItems(projectId)
      .then(setItems)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Hiba a betöltés során"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const groups = useMemo(() => groupItems(items), [items]);
  const existingGroups = useMemo(() => Array.from(new Set(items.map((i) => i.group_name))), [items]);

  function toggleGroup(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function startCreate(groupName?: string) {
    setEditingId(null);
    setForm(emptyForm(groupName ?? existingGroups[0] ?? ""));
    setShowForm(true);
  }

  function startEdit(item: ProjectSpecItem) {
    setEditingId(item.id);
    setForm({ group_name: item.group_name, label: item.label, value: item.value ?? "", note: item.note ?? "" });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.group_name.trim() || !form.label.trim()) {
      toast.error("A csoport és a megnevezés kötelező");
      return;
    }
    setSaving(true);
    try {
      if (editingId != null) {
        const updated = await api.updateSpecItem(projectId, editingId, form);
        setItems((prev) => prev.map((i) => (i.id === editingId ? updated : i)));
      } else {
        const created = await api.createSpecItem(projectId, form);
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
    if (!confirm("Biztosan törlöd ezt a sort?")) return;
    try {
      await api.deleteSpecItem(projectId, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setImporting(true);
    setParsedRows(null);
    try {
      const result = await api.parseSpecItemsImport(projectId, file);
      setParsedRows(result.rows);
      setParseWarnings(result.warnings);
      if (result.rows.length === 0) {
        toast.error("Nem találtam feldolgozható sort ebben a fájlban");
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
      const created = await api.commitSpecItemsImport(projectId, parsedRows);
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
          Műszaki/gyártástervezési adatlap — csoportosított, szabad kulcs-érték jegyzék a helyszíni adatlapok mintájára.
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowImport(true)} className="h-8 gap-1.5 text-[13px] font-semibold">
              <Upload className="size-3.5" /> Excel import
            </Button>
            <Button size="sm" onClick={() => startCreate()} className="h-8 gap-1.5 text-[13px] font-semibold">
              <Plus className="size-3.5" /> Új tétel
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">Betöltés…</p>
      ) : groups.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">Még nincs felvéve műszaki adatlap-tétel.</Card>
      ) : (
        <div className="space-y-3">
          {groups.map(([groupName, groupRows]) => {
            const isCollapsed = collapsed.has(groupName);
            return (
              <Card key={groupName} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left text-sm font-semibold"
                >
                  {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {groupName}
                  <span className="font-normal text-muted-foreground">({groupRows.length})</span>
                </button>
                {!isCollapsed && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[28%]">Megnevezés</TableHead>
                        <TableHead className="w-[40%]">Érték</TableHead>
                        <TableHead>Megjegyzés</TableHead>
                        {canEdit && <TableHead className="w-20" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupRows.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium align-top">{item.label}</TableCell>
                          <TableCell className="whitespace-pre-wrap align-top">{item.value || "—"}</TableCell>
                          <TableCell className="whitespace-pre-wrap align-top text-muted-foreground">{item.note || "—"}</TableCell>
                          {canEdit && (
                            <TableCell className="whitespace-nowrap text-right align-top">
                              <Button size="icon" variant="ghost" className="size-7" onClick={() => startEdit(item)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {canEdit && !isCollapsed && (
                  <div className="border-t p-2">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => startCreate(groupName)}>
                      <Plus className="size-3" /> Tétel ebbe a csoportba
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId != null ? "Tétel szerkesztése" : "Új adatlap-tétel"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="psi-group">Csoport</Label>
                <Input
                  id="psi-group"
                  required
                  list="psi-group-options"
                  value={form.group_name}
                  onChange={(e) => setForm({ ...form, group_name: e.target.value })}
                  placeholder="pl. Alapszerkezet, Kémény, Tetőfedés…"
                />
                <datalist id="psi-group-options">
                  {existingGroups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="psi-label">Megnevezés</Label>
                <Input id="psi-label" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="psi-value">Érték</Label>
                <Textarea id="psi-value" value={form.value ?? ""} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="psi-note">Megjegyzés</Label>
                <Textarea id="psi-note" value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
            <DialogTitle>Műszaki adatlap Excel import</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Tölts fel egy csoportosított, kulcs-érték jellegű adatlapot (pl. "Szerkezetkész" jellegű lapot). A rendszer
              megpróbálja felismerni a szekciókat és a sorokat — az eredményt importálás előtt átnézheted.
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
                      <TableHead>Csoport</TableHead>
                      <TableHead>Megnevezés</TableHead>
                      <TableHead>Érték</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{row.group_name}</TableCell>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{row.value || "—"}</TableCell>
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
