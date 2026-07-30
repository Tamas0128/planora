"use client";

import { useEffect, useState } from "react";
import { GripVertical, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AppLayout from "@/components/AppLayout";
import { ActivityTemplate, api, getCachedUser, ROLE_LABELS, User } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [string, string][];

function SortableTemplateRow({
  template, dragEnabled, children,
}: {
  template: ActivityTemplate; dragEnabled: boolean; children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
    disabled: !dragEnabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const dragHandle = dragEnabled ? (
    <button
      type="button"
      aria-label="Sorrend módosítása húzással"
      className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-3.5" />
    </button>
  ) : null;

  return (
    <TableRow ref={setNodeRef} style={style} className={cn(isDragging && "relative z-10 shadow-md")}>
      {children(dragHandle)}
    </TableRow>
  );
}

export default function ActivityTemplatesPage() {
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [editing, setEditing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    duration_days: 1,
    default_prep_days: 14,
    responsible_role: "project_manager",
  });
  const templateSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function loadTemplates() {
    api.activityTemplates().then(setTemplates).catch(console.error);
  }

  useEffect(() => {
    loadTemplates();
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const canEdit = me?.role === "admin" || me?.role === "management";
  const nameById: Record<number, string> = {};
  for (const t of templates) nameById[t.id] = t.name;
  const allIncluded = templates.length > 0 && templates.every((t) => t.include_by_default);
  const someIncluded = templates.some((t) => t.include_by_default);

  function updateLocal(id: number, patch: Partial<ActivityTemplate>) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function commitField(id: number, field: "duration_days" | "default_prep_days", value: number) {
    if (!value || value < 1 || !Number.isFinite(value)) {
      toast.error("A megadott értéknek legalább 1 napnak kell lennie.");
      loadTemplates();
      return;
    }
    try {
      await api.updateActivityTemplate(id, { [field]: value });
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
      loadTemplates();
    }
  }

  async function commitName(id: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("A tevékenység neve nem lehet üres.");
      loadTemplates();
      return;
    }
    try {
      await api.updateActivityTemplate(id, { name: trimmed });
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
      loadTemplates();
    }
  }

  async function commitRole(id: number, role: string) {
    try {
      await api.updateActivityTemplate(id, { responsible_role: role });
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function commitPosition(id: number, position: number) {
    if (!Number.isFinite(position) || position < 1) {
      toast.error("A sorszámnak legalább 1-nek kell lennie.");
      loadTemplates();
      return;
    }
    try {
      await api.updateActivityTemplate(id, { sort_order: position });
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a sorrend mentése során");
      loadTemplates();
    }
  }

  function handleTemplateDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setTemplates((prev) => arrayMove(prev, oldIndex, newIndex));
    commitPosition(Number(active.id), newIndex + 1);
  }

  async function addPrerequisite(templateId: number, prerequisiteId: number) {
    try {
      await api.addTemplateDependency(templateId, prerequisiteId);
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function removePrerequisite(templateId: number, prerequisiteId: number) {
    try {
      await api.removeTemplateDependency(templateId, prerequisiteId);
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function commitInclude(id: number, include: boolean) {
    updateLocal(id, { include_by_default: include });
    try {
      await api.updateActivityTemplate(id, { include_by_default: include });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
      loadTemplates();
    }
  }

  async function toggleAllInclude(include: boolean) {
    try {
      await api.setAllTemplatesIncludeByDefault(include);
      loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function deleteTemplate(id: number) {
    try {
      await api.deleteActivityTemplate(id);
      loadTemplates();
      toast.success("Tevékenység sablon törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createActivityTemplate(form);
      setShowNew(false);
      setForm({ name: "", duration_days: 1, default_prep_days: 14, responsible_role: "project_manager" });
      loadTemplates();
      toast.success("Tevékenység sablon létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">Ütemterv sablon</h1>
          <p className="text-xs text-muted-foreground">
            Az itt megadott tevékenységek kerülnek be minden újonnan létrehozott projekt ütemtervébe.
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing((v) => !v)}>
              <Pencil className="size-3.5" />
              {editing ? "Szerkesztés kész" : "Szerkesztés"}
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="size-3.5" /> Új tevékenység
            </Button>
          </div>
        )}
      </div>

      <p className="mb-2 text-xs text-muted-foreground">{templates.length} tevékenység sablon</p>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[70px]">Sorszám</TableHead>
              <TableHead className="min-w-[160px]">Tevékenység</TableHead>
              <TableHead className="min-w-[120px]">Felelős</TableHead>
              <TableHead className="min-w-[90px]">Futási idő (nap)</TableHead>
              <TableHead className="min-w-[90px]">Előkészítési idő (nap)</TableHead>
              <TableHead className="min-w-[160px]">Előfeltételek</TableHead>
              <TableHead className="min-w-[110px]">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={allIncluded}
                    indeterminate={someIncluded && !allIncluded}
                    disabled={!(canEdit && editing)}
                    aria-label="Összes be/ki kapcsolása"
                    onCheckedChange={() => toggleAllInclude(!allIncluded)}
                  />
                  Alapból bekerül
                </div>
              </TableHead>
              {editing && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            <DndContext
              sensors={templateSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleTemplateDragEnd}
            >
              <SortableContext items={templates.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {templates.map((t) => (
              <SortableTemplateRow key={t.id} template={t} dragEnabled={!!canEdit && editing}>
                {(dragHandle) => (<>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {dragHandle}
                    {canEdit && editing ? (
                      <Input
                        type="number"
                        min={1}
                        value={t.sort_order + 1}
                        aria-label="Sorszám"
                        onChange={(e) => updateLocal(t.id, { sort_order: Number(e.target.value) - 1 })}
                        onBlur={(e) => commitPosition(t.id, Number(e.target.value))}
                        className="w-14"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.sort_order + 1}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {canEdit && editing ? (
                    <Input
                      value={t.name}
                      aria-label="Tevékenység neve"
                      onChange={(e) => updateLocal(t.id, { name: e.target.value })}
                      onBlur={(e) => commitName(t.id, e.target.value)}
                      className="min-w-[140px]"
                    />
                  ) : (
                    <span className="text-xs">{t.name}</span>
                  )}
                </TableCell>
                <TableCell>
                  {canEdit && editing ? (
                    <Select value={t.responsible_role} onValueChange={(v) => commitRole(t.id, v as string)}>
                      <SelectTrigger size="sm" className="min-w-[120px]">
                        <SelectValue>{(v: string) => ROLE_LABELS[v] || v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[t.responsible_role] || t.responsible_role}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {canEdit && editing ? (
                    <Input
                      type="number"
                      min={1}
                      value={t.duration_days}
                      aria-label="Futási idő napokban"
                      onChange={(e) => updateLocal(t.id, { duration_days: Number(e.target.value) })}
                      onBlur={(e) => commitField(t.id, "duration_days", Number(e.target.value))}
                      className="w-16"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{t.duration_days}</span>
                  )}
                </TableCell>
                <TableCell>
                  {canEdit && editing ? (
                    <Input
                      type="number"
                      min={1}
                      value={t.default_prep_days}
                      aria-label="Előkészítési idő napokban"
                      onChange={(e) => updateLocal(t.id, { default_prep_days: Number(e.target.value) })}
                      onBlur={(e) => commitField(t.id, "default_prep_days", Number(e.target.value))}
                      className="w-16"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{t.default_prep_days}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {t.prerequisite_template_ids.map((pid) => (
                      <Badge key={pid} variant="secondary" className="gap-1">
                        {nameById[pid] || `#${pid}`}
                        {canEdit && editing && (
                          <button
                            type="button"
                            onClick={() => removePrerequisite(t.id, pid)}
                            aria-label="Előfeltétel eltávolítása"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {canEdit && editing && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="outline" size="icon-xs" aria-label="Előfeltétel hozzáadása" />}
                        >
                          <Plus />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {templates
                            .filter((other) => other.id !== t.id && !t.prerequisite_template_ids.includes(other.id))
                            .map((other) => (
                              <DropdownMenuItem
                                key={other.id}
                                onClick={() => addPrerequisite(t.id, other.id)}
                              >
                                {other.name}
                              </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={t.include_by_default}
                    disabled={!(canEdit && editing)}
                    aria-label="Alapból bekerüljön az új projektekbe"
                    onCheckedChange={(checked) => commitInclude(t.id, !!checked)}
                  />
                </TableCell>
                {editing && (
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={<Button variant="link" className="h-auto p-0 text-xs text-destructive" />}
                      >
                        Törlés
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Biztosan törlöd ezt a tevékenység sablont?</AlertDialogTitle>
                          <AlertDialogDescription>
                            &quot;{t.name}&quot; törlődik a sablonból. A már létrehozott projektek
                            ütemtervét ez nem érinti.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Mégse</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTemplate(t.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Törlés
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
                </>)}
              </SortableTemplateRow>
            ))}
              </SortableContext>
            </DndContext>
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nincs tevékenység sablon
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <form onSubmit={createTemplate}>
            <DialogHeader>
              <DialogTitle>Új tevékenység sablon</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-name">Tevékenység neve</Label>
                <Input
                  id="tmpl-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Felelős</Label>
                <Select
                  value={form.responsible_role}
                  onValueChange={(v) => setForm({ ...form, responsible_role: v as string })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => ROLE_LABELS[v] || v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-duration">Futási idő (nap)</Label>
                <Input
                  id="tmpl-duration"
                  type="number"
                  min={1}
                  required
                  value={form.duration_days}
                  onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-prep">Előkészítési idő (nap)</Label>
                <Input
                  id="tmpl-prep"
                  type="number"
                  min={1}
                  required
                  value={form.default_prep_days}
                  onChange={(e) => setForm({ ...form, default_prep_days: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Mentés..." : "Létrehozás"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
