"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  Activity,
  api,
  BUILDING_LABELS,
  ProjectDetail,
  ProjectDocument,
  ROLE_LABELS,
  STATUS_LABELS,
  User,
} from "@/lib/api";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const BUILDING_OPTIONS: [string, string][] = [
  ["light_steel", "Könnyűszerkezetes"],
  ["clt", "CLT"],
  ["timber_frame", "Gerendaház"],
  ["other", "Egyéb"],
];

const STATUS_OPTIONS: [string, string][] = [
  ["planning", "Tervezés alatt"],
  ["foundation", "Alapozás"],
  ["structure", "Szerkezetállítás"],
  ["exterior_done", "Kívülről kész"],
  ["turnkey", "Kulcsrakész"],
];

const ASSIGNMENT_FIELDS: [string, string][] = [
  ["project_manager_id", "Projektmenedzser"],
  ["site_manager_id", "Építésvezető"],
  ["procurement_id", "Beszerzés"],
  ["billing_id", "Számlázás"],
];

const ACTIVITY_STATUS_OPTIONS: [string, string][] = [
  ["pending", "Várakozik"],
  ["in_progress", "Folyamatban"],
  ["done", "Kész"],
  ["blocked", "Blokkolt"],
];

const ACTIVITY_STATUS_COLOR: Record<string, string> = {
  pending: "text-slate-600",
  in_progress: "text-amber-600",
  done: "text-emerald-600",
  blocked: "text-red-600",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [tab, setTab] = useState<"info" | "schedule" | "documents">("info");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function loadProject() {
    api.project(id).then(setProject).catch(console.error);
  }
  function loadActivities() {
    api.activities(id).then(setActivities).catch(console.error);
  }
  function loadDocuments() {
    api.documents(id).then(setDocuments).catch(console.error);
  }

  useEffect(() => {
    if (!id) return;
    loadProject();
    loadActivities();
    loadDocuments();
    api.me().then(setMe).catch(() => setMe(null));
    api.users().then(setUsers).catch(() => setUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "project_manager";

  async function updateStatus(activityId: number, status: string) {
    await api.updateActivity(id, activityId, { status });
    loadActivities();
    loadProject();
  }

  function startEdit() {
    if (!project) return;
    setForm({
      name: project.name,
      settlement: project.settlement,
      address: project.address,
      lot_number: project.lot_number || "",
      client_name: project.client_name,
      client_phone: project.client_phone || "",
      client_email: project.client_email || "",
      building_type: project.building_type,
      floor_area_sqm: project.floor_area_sqm,
      delivery_date: project.delivery_date,
      status: project.status,
      project_manager_id: project.project_manager_id ?? "",
      site_manager_id: project.site_manager_id ?? "",
      procurement_id: project.procurement_id ?? "",
      billing_id: project.billing_id ?? "",
      subcontractors: project.subcontractors || "",
    });
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      for (const [key] of ASSIGNMENT_FIELDS) {
        payload[key] = payload[key] ? Number(payload[key]) : null;
      }
      payload.floor_area_sqm = Number(payload.floor_area_sqm);
      for (const key of ["lot_number", "client_phone", "client_email", "subcontractors"]) {
        if (payload[key] === "") payload[key] = null;
      }
      await api.updateProject(id, payload);
      setEditing(false);
      loadProject();
      toast.success("Projekt mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(id, file);
      loadDocuments();
      toast.success("Dokumentum feltöltve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Feltöltés sikertelen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDownload(documentId: number) {
    // Open the tab synchronously, inside the click handler, so browsers still
    // treat it as a direct result of user interaction. Navigating it only
    // after the presigned-URL fetch resolves (the old approach) crosses an
    // await boundary and popup blockers may silently swallow window.open then.
    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error("A böngésző blokkolta a felugró ablakot. Engedélyezd a felugró ablakokat ehhez az oldalhoz, majd próbáld újra.");
      return;
    }
    try {
      const { url } = await api.downloadDocument(id, documentId);
      tab.location.href = url;
    } catch (err) {
      tab.close();
      toast.error(err instanceof Error ? err.message : "Hiba a letöltés során");
    }
  }

  async function handleDeleteDocument(documentId: number) {
    await api.deleteDocument(id, documentId);
    loadDocuments();
  }

  async function addPrerequisite(activityId: number, prerequisiteId: number) {
    try {
      await api.addDependency(id, activityId, prerequisiteId);
      loadActivities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function removePrerequisite(activityId: number, prerequisiteId: number) {
    await api.removeDependency(id, activityId, prerequisiteId);
    loadActivities();
  }

  function updateLocalActivity(activityId: number, patch: Partial<Activity>) {
    setActivities((prev) => prev.map((a) => (a.id === activityId ? { ...a, ...patch } : a)));
  }

  async function commitActivityField(activityId: number, field: "duration_days" | "prep_days", value: number) {
    if (!value || value < 1 || !Number.isFinite(value)) {
      toast.error("A megadott értéknek legalább 1 napnak kell lennie.");
      loadActivities();
      return;
    }
    try {
      await api.updateActivity(id, activityId, { [field]: value });
      loadActivities();
      loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
      loadActivities();
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    try {
      await api.deleteProject(id);
      router.push("/projects");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  if (!project) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Betöltés...</p>
      </AppLayout>
    );
  }

  const activityNameById: Record<number, string> = {};
  for (const a of activities) activityNameById[a.id] = a.name;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-muted-foreground">
          {project.project_code} · {project.settlement}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="info">Adatlap</TabsTrigger>
          <TabsTrigger value="schedule">Ütemterv</TabsTrigger>
          <TabsTrigger value="documents">Dokumentumok</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          {!editing && (
            <div>
              {canEdit && (
                <div className="mb-4 flex gap-2">
                  <Button
                    onClick={startEdit}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
                  >
                    Szerkesztés
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" />}
                    >
                      Törlés
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Biztosan törlöd ezt a projektet?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A &quot;{project.name}&quot; projektet minden tevékenységével és
                          dokumentumával együtt törli. Ez nem visszavonható.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Mégse</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteProject}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Törlés
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="p-5">
                  <h3 className="mb-3 font-semibold">Projekt adatok</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Státusz</dt><dd>{STATUS_LABELS[project.status]}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Cím</dt><dd>{project.address}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Helyrajzi szám</dt><dd>{project.lot_number || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Épülettípus</dt><dd>{BUILDING_LABELS[project.building_type]}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Alapterület</dt><dd>{project.floor_area_sqm} m²</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Átadás</dt><dd>{new Date(project.delivery_date).toLocaleDateString("hu-HU")}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Készültség</dt><dd>{project.completion_percent}%</dd></div>
                  </dl>
                </Card>
                <Card className="p-5">
                  <h3 className="mb-3 font-semibold">Ügyfél</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Név</dt><dd>{project.client_name}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Telefon</dt><dd>{project.client_phone || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">E-mail</dt><dd>{project.client_email || "—"}</dd></div>
                  </dl>
                </Card>
                <Card className="p-5 md:col-span-2">
                  <h3 className="mb-3 font-semibold">Résztvevők</h3>
                  <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-muted-foreground">Projektmenedzser</dt><dd>{project.project_manager_name || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Építésvezető</dt><dd>{project.site_manager_name || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Beszerzés</dt><dd>{project.procurement_name || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Számlázás</dt><dd>{project.billing_name || "—"}</dd></div>
                  </dl>
                  {project.subcontractors && (
                    <div className="mt-3 text-sm">
                      <dt className="text-muted-foreground">Alvállalkozók</dt>
                      <dd className="mt-1 whitespace-pre-wrap">{project.subcontractors}</dd>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {editing && (
            <Card className="p-6">
              <form onSubmit={saveEdit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Projekt neve</Label>
                    <Input
                      id="name"
                      required
                      value={form.name as string}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settlement">Település</Label>
                    <Input
                      id="settlement"
                      required
                      value={form.settlement as string}
                      onChange={(e) => setForm({ ...form, settlement: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Cím</Label>
                    <Input
                      id="address"
                      required
                      value={form.address as string}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lot_number">Helyrajzi szám</Label>
                    <Input
                      id="lot_number"
                      value={form.lot_number as string}
                      onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client_name">Ügyfél neve</Label>
                    <Input
                      id="client_name"
                      required
                      value={form.client_name as string}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client_phone">Ügyfél telefon</Label>
                    <Input
                      id="client_phone"
                      value={form.client_phone as string}
                      onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client_email">Ügyfél e-mail</Label>
                    <Input
                      id="client_email"
                      type="email"
                      value={form.client_email as string}
                      onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Épülettípus</Label>
                    <Select
                      value={form.building_type as string}
                      onValueChange={(v) => setForm({ ...form, building_type: v as string })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUILDING_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="floor_area_sqm">Alapterület (m²)</Label>
                    <Input
                      id="floor_area_sqm"
                      type="number"
                      required
                      value={form.floor_area_sqm as number}
                      onChange={(e) => setForm({ ...form, floor_area_sqm: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery_date">Átadási határidő</Label>
                    <Input
                      id="delivery_date"
                      type="date"
                      required
                      value={form.delivery_date as string}
                      onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Státusz</Label>
                    <Select
                      value={form.status as string}
                      onValueChange={(v) => setForm({ ...form, status: v as string })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="mb-3 font-semibold">Résztvevők</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {ASSIGNMENT_FIELDS.map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{label}</Label>
                        <Select
                          value={(form[key] as string) || "none"}
                          onValueChange={(v) => setForm({ ...form, [key]: v === "none" ? "" : (v as string) })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.full_name} ({ROLE_LABELS[u.role] || u.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <Label htmlFor="subcontractors">Alvállalkozók</Label>
                    <Textarea
                      id="subcontractors"
                      rows={3}
                      value={form.subcontractors as string}
                      onChange={(e) => setForm({ ...form, subcontractors: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2 border-t pt-4">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
                  >
                    {saving ? "Mentés..." : "Mentés"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Mégse
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tevékenység</TableHead>
                  <TableHead>Futási idő (nap)</TableHead>
                  <TableHead>Előkészítési idő (nap)</TableHead>
                  <TableHead>Előkészítés dátuma</TableHead>
                  <TableHead>Kezdés</TableHead>
                  <TableHead>Befejezés</TableHead>
                  <TableHead>Előfeltételek</TableHead>
                  <TableHead>Státusz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={a.duration_days}
                        disabled={!canEdit}
                        onChange={(e) => updateLocalActivity(a.id, { duration_days: Number(e.target.value) })}
                        onBlur={(e) => commitActivityField(a.id, "duration_days", Number(e.target.value))}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={a.prep_days}
                        disabled={!canEdit}
                        onChange={(e) => updateLocalActivity(a.id, { prep_days: Number(e.target.value) })}
                        onBlur={(e) => commitActivityField(a.id, "prep_days", Number(e.target.value))}
                        className="w-16"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.prep_date ? new Date(a.prep_date).toLocaleDateString("hu-HU") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.start_date ? new Date(a.start_date).toLocaleDateString("hu-HU") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.end_date ? new Date(a.end_date).toLocaleDateString("hu-HU") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {a.prerequisite_ids.map((pid) => (
                          <Badge key={pid} variant="secondary" className="gap-1">
                            {activityNameById[pid] || `#${pid}`}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => removePrerequisite(a.id, pid)}
                                className="text-muted-foreground hover:text-destructive"
                                title="Eltávolítás"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="outline" size="icon-xs" title="Előfeltétel hozzáadása" />}
                            >
                              <Plus />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {activities
                                .filter((other) => other.id !== a.id && !a.prerequisite_ids.includes(other.id))
                                .map((other) => (
                                  <DropdownMenuItem
                                    key={other.id}
                                    onClick={() => addPrerequisite(a.id, other.id)}
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
                      <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v as string)}>
                        <SelectTrigger size="sm" className={ACTIVITY_STATUS_COLOR[a.status]}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_STATUS_OPTIONS.map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card className="py-0">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">Dokumentumok</h3>
              <label
                className={cn(
                  buttonVariants(),
                  "cursor-pointer bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500"
                )}
              >
                <Upload />
                {uploading ? "Feltöltés..." : "Feltöltés"}
                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fájlnév</TableHead>
                  <TableHead>Típus</TableHead>
                  <TableHead>Méret</TableHead>
                  <TableHead>Verzió</TableHead>
                  <TableHead>Feltöltve</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.original_filename}</TableCell>
                    <TableCell className="text-muted-foreground">{doc.content_type}</TableCell>
                    <TableCell className="text-muted-foreground">{formatBytes(doc.file_size)}</TableCell>
                    <TableCell>v{doc.version}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(doc.created_at).toLocaleString("hu-HU")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" onClick={() => handleDownload(doc.id)} className="h-auto p-0">
                        Letöltés
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={<Button variant="link" className="ml-3 h-auto p-0 text-destructive" />}
                        >
                          Törlés
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Biztosan törlöd ezt a dokumentumot?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{doc.original_filename}&quot; véglegesen törlődik.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Mégse</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="bg-destructive text-white hover:bg-destructive/90"
                            >
                              Törlés
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {documents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nincs feltöltött dokumentum
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
