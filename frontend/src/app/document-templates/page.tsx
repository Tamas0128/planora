"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  api,
  BUILDING_LABELS,
  DocumentTemplate,
  DOCUMENT_FAMILY_LABELS,
  getCachedUser,
  TIG_DOCUMENT_SUBTYPE_LABELS,
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

const FAMILY_OPTIONS = Object.entries(DOCUMENT_FAMILY_LABELS) as [string, string][];
const SUBTYPE_OPTIONS = Object.entries(TIG_DOCUMENT_SUBTYPE_LABELS) as [string, string][];
const BUILDING_OPTIONS = Object.entries(BUILDING_LABELS) as [string, string][];

const emptyForm = {
  family: "tig",
  doc_subtype: "normal",
  building_type: "",
  is_delay_variant: false,
  name: "",
  file: null as File | null,
};

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function loadTemplates() {
    api.listDocumentTemplates().then(setTemplates).catch(() => setTemplates([]));
  }

  useEffect(() => {
    loadTemplates();
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const isAdmin = me?.role === "admin";

  async function toggleActive(template: DocumentTemplate) {
    try {
      await api.updateDocumentTemplate(template.id, { is_active: !template.is_active });
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.file) return;
    setCreating(true);
    try {
      await api.uploadDocumentTemplate({
        family: form.family,
        doc_subtype: form.doc_subtype,
        building_type: form.building_type || undefined,
        is_delay_variant: form.is_delay_variant,
        name: form.name,
        file: form.file,
      });
      setShowNew(false);
      setForm(emptyForm);
      loadTemplates();
      toast.success("Sablon feltöltve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a feltöltés során");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Dokumentumsablonok</h1>
          <p className="text-xs text-muted-foreground">
            A TIG, ügyfél- és alvállalkozói szerződés dokumentumok automatikus generálásához használt .docx sablonok.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="size-3.5" /> Új sablon
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Család</TableHead>
              <TableHead>Altípus</TableHead>
              <TableHead>Épülettípus</TableHead>
              <TableHead>Csúszás-variáns</TableHead>
              <TableHead>Név</TableHead>
              <TableHead>Verzió</TableHead>
              <TableHead>Aktív</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs">{DOCUMENT_FAMILY_LABELS[t.family] ?? t.family}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{TIG_DOCUMENT_SUBTYPE_LABELS[t.doc_subtype] ?? t.doc_subtype}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.building_type ? (BUILDING_LABELS[t.building_type] ?? t.building_type) : "Bármely"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.is_delay_variant ? "Igen" : "—"}</TableCell>
                <TableCell className="text-xs font-medium">{t.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">v{t.version}</TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Checkbox
                      checked={t.is_active}
                      aria-label="Sablon aktív"
                      onCheckedChange={() => toggleActive(t)}
                    />
                  ) : (
                    <Badge variant={t.is_active ? "default" : "outline"} className="text-xs">
                      {t.is_active ? "Aktív" : "Inaktív"}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nincs feltöltött sablon
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <form onSubmit={createTemplate}>
            <DialogHeader><DialogTitle>Új dokumentumsablon</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label>Dokumentumcsalád</Label>
                <Select value={form.family} onValueChange={(v) => setForm({ ...form, family: v as string })}>
                  <SelectTrigger className="w-full"><SelectValue>{(v: string) => DOCUMENT_FAMILY_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {FAMILY_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Altípus</Label>
                <Select value={form.doc_subtype} onValueChange={(v) => setForm({ ...form, doc_subtype: v as string })}>
                  <SelectTrigger className="w-full"><SelectValue>{(v: string) => TIG_DOCUMENT_SUBTYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {SUBTYPE_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Csak TIG családnál van jelentősége — a másik két családnál maradjon Normál.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Épülettípus</Label>
                <Select value={form.building_type || "any"} onValueChange={(v) => setForm({ ...form, building_type: v === "any" ? "" : (v as string) })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => (v === "any" ? "Bármely (catch-all)" : BUILDING_LABELS[v] ?? v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Bármely (catch-all)</SelectItem>
                    {BUILDING_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.is_delay_variant}
                  aria-label="Csúszás-variáns"
                  onCheckedChange={(checked) => setForm({ ...form, is_delay_variant: !!checked })}
                />
                <Label className="font-normal">Csúszás-variáns (indoklás mezőt tartalmazó sablon)</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-name">Sablon neve</Label>
                <Input id="tmpl-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-file">.docx fájl</Label>
                <Input
                  id="tmpl-file"
                  type="file"
                  accept=".docx"
                  required
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating || !form.file || !form.name}>
                {creating ? "Feltöltés..." : "Feltöltés"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
