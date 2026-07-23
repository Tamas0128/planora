"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, Download, GripVertical, Image as ImageIcon, Pencil, Plus, QrCode, TriangleAlert, Upload, X } from "lucide-react";
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
import {
  Activity,
  api,
  AuditLogEntry,
  BUILDING_LABELS,
  downloadFile,
  getCachedUser,
  ProjectDetail,
  ProjectDocument,
  ProjectPhoto,
  ROLE_LABELS,
  STATUS_LABELS,
  User,
  UserBrief,
} from "@/lib/api";
import { HEALTH_CFG } from "@/lib/project-utils";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [string, string][];

const ACTIVITY_STATUS_COLOR: Record<string, string> = {
  pending: "text-slate-600",
  in_progress: "text-amber-600",
  done: "text-emerald-600",
  blocked: "text-orange-600",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProjectThumbnail({
  projectId, hasThumbnail, canEdit, onUploaded,
}: {
  projectId: number; hasThumbnail: boolean; canEdit: boolean; onUploaded: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasThumbnail) {
      api.thumbnailUrl(projectId).then((r) => setUrl(r.url)).catch(() => setUrl(null));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset, no async step needed
      setUrl(null);
    }
  }, [projectId, hasThumbnail]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadThumbnail(projectId, file);
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a feltöltés során");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          aria-label="Bélyegkép feltöltése"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      )}
      <button
        type="button"
        disabled={!canEdit || uploading}
        onClick={() => inputRef.current?.click()}
        title={canEdit ? "Bélyegkép módosítása" : undefined}
        className={cn(
          "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
          canEdit && "cursor-pointer hover:border-blue-400",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static/local asset
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-slate-300" />
        )}
      </button>
    </div>
  );
}

function PhotoUploadForm({ onUpload }: { onUpload: (file: File, takenAt: string, comment: string) => Promise<void> }) {
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split("T")[0]);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file, takenAt, comment);
      setComment("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="photo-taken-at" className="text-[11px]">Dátum</Label>
        <input
          id="photo-taken-at"
          type="date"
          value={takenAt}
          onChange={(e) => setTakenAt(e.target.value)}
          className="block h-8 rounded border border-slate-200 bg-transparent px-2 text-xs focus:border-blue-500 focus:outline-none"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="photo-comment" className="text-[11px]">Megjegyzés</Label>
        <Input
          id="photo-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="h-8 w-48 text-xs"
          placeholder="Opcionális"
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <Button type="button" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="size-3.5" />
        {uploading ? "Feltöltés..." : "Fotó feltöltése"}
      </Button>
    </div>
  );
}

function SortableActivityRow({
  activity, dragEnabled, children,
}: {
  activity: Activity; dragEnabled: boolean; children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
    disabled: !dragEnabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const dragHandle = dragEnabled ? (
    <button
      type="button"
      aria-label="Sorrend módosítása húzással"
      className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-3.5" />
    </button>
  ) : null;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(!activity.is_active && "bg-slate-50 opacity-50", isDragging && "relative z-10 shadow-md")}
    >
      {children(dragHandle)}
    </TableRow>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<UserBrief[]>([]);
  // Initialise synchronously from cache so canEdit is true on first render
  // when AppLayout already resolved /auth/me (avoids a flash of read-only UI).
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [tab, setTab] = useState<
    "info" | "schedule" | "documents" | "photos" | "prep" | "participants" | "log"
  >("info");
  const [prepFilter, setPrepFilter] = useState<"all" | "overdue" | "today" | "7d" | "14d">("all");
  const [editing, setEditing] = useState(false);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const activitySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");

  function loadProject() {
    api.project(id).then((p) => { setProject(p); setDeliveryDate(p.delivery_date); }).catch(console.error);
  }
  function loadActivities() {
    api.activities(id).then(setActivities).catch(console.error);
  }
  function loadDocuments() {
    api.documents(id).then(setDocuments).catch(console.error);
  }
  function loadPhotos() {
    api.photos(id).then(setPhotos).catch(console.error);
  }
  function loadAuditLog() {
    api.auditLogs(id).then(setAuditLog).catch(console.error);
  }

  useEffect(() => {
    if (!id) return;
    loadProject();
    loadActivities();
    loadDocuments();
    loadPhotos();
    loadAuditLog();
    api.me().then(setMe).catch(() => setMe(null));
    api.users().then(setUsers).catch(() => setUsers([]));
    api.usersDirectory().then(setAssignableUsers).catch(() => setAssignableUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "project_manager" || me?.role === "site_manager";

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

  async function handleGanttPdf() {
    if (!project) return;
    try {
      await downloadFile(`/projects/${id}/gantt.pdf`, `${project.project_code}_gantt.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a Gantt-diagram létrehozása során");
    }
  }

  async function handleDeleteDocument(documentId: number) {
    try {
      await api.deleteDocument(id, documentId);
      loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function handlePhotoUpload(file: File, takenAt: string, comment: string) {
    try {
      await api.uploadPhoto(id, file, takenAt, comment || undefined);
      loadPhotos();
      toast.success("Fotó feltöltve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Feltöltés sikertelen");
    }
  }

  async function handlePhotoDownload(photoId: number) {
    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error("A böngésző blokkolta a felugró ablakot. Engedélyezd a felugró ablakokat ehhez az oldalhoz, majd próbáld újra.");
      return;
    }
    try {
      const { url } = await api.downloadPhoto(id, photoId);
      tab.location.href = url;
    } catch (err) {
      tab.close();
      toast.error(err instanceof Error ? err.message : "Hiba a letöltés során");
    }
  }

  async function handleDeletePhoto(photoId: number) {
    try {
      await api.deletePhoto(id, photoId);
      loadPhotos();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
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
    try {
      await api.removeDependency(id, activityId, prerequisiteId);
      loadActivities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba");
    }
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

  async function commitActivityName(activityId: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("A tevékenység neve nem lehet üres.");
      loadActivities();
      return;
    }
    try {
      await api.updateActivity(id, activityId, { name: trimmed });
      loadActivities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
      loadActivities();
    }
  }

  async function commitActivityRole(activityId: number, role: string) {
    try {
      await api.updateActivity(id, activityId, { responsible_role: role });
      loadActivities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function commitActivityAssignee(activityId: number, value: string) {
    try {
      await api.updateActivity(id, activityId, { assignee_id: value === "none" ? null : Number(value) });
      loadActivities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function toggleActivityActive(a: Activity) {
    try {
      await api.updateActivity(id, a.id, { is_active: !a.is_active });
      loadActivities();
      loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function commitActivityPosition(activityId: number, position: number) {
    if (!Number.isFinite(position) || position < 1) {
      toast.error("A sorszámnak legalább 1-nek kell lennie.");
      loadActivities();
      return;
    }
    try {
      await api.updateActivity(id, activityId, { sort_order: position });
      loadActivities();
      loadProject();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a sorrend mentése során");
      loadActivities();
    }
  }

  function handleActivityDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activities.findIndex((a) => a.id === active.id);
    const newIndex = activities.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setActivities((prev) => arrayMove(prev, oldIndex, newIndex));
    commitActivityPosition(Number(active.id), newIndex + 1);
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
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProjectThumbnail
            projectId={id}
            hasThumbnail={project.has_thumbnail}
            canEdit={canEdit}
            onUploaded={loadProject}
          />
          <div>
            <h1 className="text-lg font-bold text-slate-900">{project.name}</h1>
            <p className="text-xs text-slate-500">
              {project.project_code} · {project.settlement}
            </p>
          </div>
        </div>
        {/* Inline delivery date */}
        <Card className="flex items-center gap-3 px-3 py-2 shadow-sm">
          <Calendar className="size-4 shrink-0 text-slate-400" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Átadási határidő
            </p>
            {canEdit ? (
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                onBlur={async () => {
                  if (!deliveryDate || deliveryDate === project.delivery_date) return;
                  try {
                    await api.updateProject(id, { delivery_date: deliveryDate });
                    loadProject();
                    loadActivities();
                    toast.success("Határidő frissítve, ütemterv újraszámítva");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Hiba");
                    setDeliveryDate(project.delivery_date);
                  }
                }}
                className="mt-0.5 block rounded border border-slate-200 bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            ) : (
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
              </p>
            )}
          </div>
          <div className="ml-4 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Készültség</p>
            <p className="mt-0.5 text-sm font-bold text-blue-600">{project.completion_percent}%</p>
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="info">Áttekintés</TabsTrigger>
          <TabsTrigger value="schedule">Ütemterv</TabsTrigger>
          <TabsTrigger value="documents">Dokumentumok</TabsTrigger>
          <TabsTrigger value="photos">Fotók</TabsTrigger>
          <TabsTrigger value="prep">Előkészítés</TabsTrigger>
          <TabsTrigger value="participants">Résztvevők</TabsTrigger>
          <TabsTrigger value="log">Napló</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          {!editing && (
            <div>
              {canEdit && (
                <div className="mb-3 flex gap-2">
                  <Button onClick={startEdit}>
                    Szerkesztés
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50" />}
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
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Készültség</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{project.completion_percent}%</p>
                </Card>
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mai feladatok</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">
                    {activities.filter((a) => a.is_active && a.start_date?.slice(0, 10) === new Date().toISOString().split("T")[0]).length}
                  </p>
                </Card>
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Késő feladatok</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">
                    {activities.filter((a) => a.is_active && a.prep_date && a.prep_date < new Date().toISOString().split("T")[0] && a.status !== "done").length}
                  </p>
                </Card>
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dok. / Fotó</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{documents.length} / {photos.length}</p>
                </Card>
              </div>

              {project.delay_risk !== "ok" && (
                <Card className={cn("mb-3 flex items-start gap-2 p-3", HEALTH_CFG[project.delay_risk]?.badge)}>
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold">
                      Késés-előrejelzés: {HEALTH_CFG[project.delay_risk]?.label ?? project.delay_risk}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-90">{project.delay_risk_reason}</p>
                  </div>
                </Card>
              )}

              <div className="mb-3">
                <Dialog>
                  <DialogTrigger render={<Button variant="outline" size="sm" />}>
                    <QrCode className="size-3.5" /> QR-kód
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xs">
                    <DialogHeader>
                      <DialogTitle>{project.name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-2 py-2">
                      {typeof window !== "undefined" && (
                        <QRCodeSVG value={window.location.href} size={200} />
                      )}
                      <p className="text-center text-[11px] text-muted-foreground">
                        Beolvasva a projekt gyorsan megnyitható helyszíni mobil eszközön.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="p-3">
                  <h3 className="mb-2 text-[13px] font-semibold">Projekt adatok</h3>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Státusz</dt><dd>{STATUS_LABELS[project.status]}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Cím</dt><dd>{project.address}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Helyrajzi szám</dt><dd>{project.lot_number || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Épülettípus</dt><dd>{BUILDING_LABELS[project.building_type]}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Alapterület</dt><dd>{project.floor_area_sqm} m²</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Átadás</dt><dd>{new Date(project.delivery_date).toLocaleDateString("hu-HU")}</dd></div>
                  </dl>
                </Card>
                <Card className="p-3">
                  <h3 className="mb-2 text-[13px] font-semibold">Ügyfél</h3>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Név</dt><dd>{project.client_name}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Telefon</dt><dd>{project.client_phone || "—"}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">E-mail</dt><dd>{project.client_email || "—"}</dd></div>
                  </dl>
                </Card>
              </div>
            </div>
          )}

          {editing && (
            <Card className="p-4">
              <form onSubmit={saveEdit} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                        <SelectValue>{(v: string) => BUILDING_LABELS[v] || v}</SelectValue>
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
                        <SelectValue>{(v: string) => STATUS_LABELS[v] || v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h3 className="mb-2 text-[13px] font-semibold">Résztvevők</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {ASSIGNMENT_FIELDS.map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{label}</Label>
                        <Select
                          value={(form[key] as string) || "none"}
                          onValueChange={(v) => setForm({ ...form, [key]: v === "none" ? "" : (v as string) })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(v: string) => {
                                if (v === "none") return "—";
                                const u = users.find((usr) => String(usr.id) === v);
                                return u ? `${u.full_name} (${ROLE_LABELS[u.role] || u.role})` : v;
                              }}
                            </SelectValue>
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
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="subcontractors">Alvállalkozók</Label>
                    <Textarea
                      id="subcontractors"
                      rows={3}
                      value={form.subcontractors as string}
                      onChange={(e) => setForm({ ...form, subcontractors: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2 border-t pt-3">
                  <Button type="submit" disabled={saving}>
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

        <TabsContent value="schedule" className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">{activities.length} tevékenység</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleGanttPdf}>
                <Download className="size-3.5" />
                Gantt PDF
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant={scheduleEditing ? "default" : "outline"}
                  onClick={() => setScheduleEditing((v) => !v)}
                >
                  <Pencil className="size-3.5" />
                  {scheduleEditing ? "Szerkesztés kész" : "Szerkesztés"}
                </Button>
              )}
            </div>
          </div>
          <Card className="overflow-x-auto py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[70px]">Sorszám</TableHead>
                  <TableHead className="min-w-[160px]">Tevékenység</TableHead>
                  <TableHead className="min-w-[120px]">Felelős</TableHead>
                  <TableHead className="min-w-[140px]">Kijelölve</TableHead>
                  <TableHead className="min-w-[90px]">Futási idő (nap)</TableHead>
                  <TableHead className="min-w-[90px]">Előkészítési idő (nap)</TableHead>
                  <TableHead className="min-w-[110px]">Előkészítés dátuma</TableHead>
                  <TableHead className="min-w-[100px]">Kezdés</TableHead>
                  <TableHead className="min-w-[100px]">Befejezés</TableHead>
                  <TableHead className="min-w-[160px]">Előfeltételek</TableHead>
                  <TableHead className="min-w-[130px]">Státusz</TableHead>
                  <TableHead className="min-w-[90px]">Állapot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <DndContext
                  sensors={activitySensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleActivityDragEnd}
                >
                  <SortableContext items={activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                {activities.map((a) => (
                  <SortableActivityRow key={a.id} activity={a} dragEnabled={!!canEdit && scheduleEditing}>
                    {(dragHandle) => (<>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {dragHandle}
                        {canEdit && scheduleEditing ? (
                          <Input
                            type="number"
                            min={1}
                            value={a.sort_order + 1}
                            aria-label="Sorszám"
                            onChange={(e) => updateLocalActivity(a.id, { sort_order: Number(e.target.value) - 1 })}
                            onBlur={(e) => commitActivityPosition(a.id, Number(e.target.value))}
                            className="w-14"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{a.sort_order + 1}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {canEdit && scheduleEditing ? (
                        <Input
                          value={a.name}
                          aria-label="Tevékenység neve"
                          onChange={(e) => updateLocalActivity(a.id, { name: e.target.value })}
                          onBlur={(e) => commitActivityName(a.id, e.target.value)}
                          className="min-w-[140px]"
                        />
                      ) : (
                        <span className="text-xs">{a.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && scheduleEditing ? (
                        <Select
                          value={a.responsible_role}
                          onValueChange={(v) => commitActivityRole(a.id, v as string)}
                        >
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
                          {ROLE_LABELS[a.responsible_role] || a.responsible_role}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && scheduleEditing ? (
                        <Select
                          value={a.assignee_id ? String(a.assignee_id) : "none"}
                          onValueChange={(v) => commitActivityAssignee(a.id, v as string)}
                        >
                          <SelectTrigger size="sm" className="min-w-[130px]">
                            <SelectValue>
                              {() => a.assignee_name ?? "Nincs kijelölve"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nincs kijelölve</SelectItem>
                            {assignableUsers.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.assignee_name ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && scheduleEditing ? (
                        <Input
                          type="number"
                          min={1}
                          value={a.duration_days}
                          aria-label="Futási idő napokban"
                          onChange={(e) => updateLocalActivity(a.id, { duration_days: Number(e.target.value) })}
                          onBlur={(e) => commitActivityField(a.id, "duration_days", Number(e.target.value))}
                          className="w-16"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{a.duration_days}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && scheduleEditing ? (
                        <Input
                          type="number"
                          min={1}
                          value={a.prep_days}
                          aria-label="Előkészítési idő napokban"
                          onChange={(e) => updateLocalActivity(a.id, { prep_days: Number(e.target.value) })}
                          onBlur={(e) => commitActivityField(a.id, "prep_days", Number(e.target.value))}
                          className="w-16"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{a.prep_days}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.prep_date ? new Date(a.prep_date).toLocaleDateString("hu-HU") : "—"}
                    </TableCell>
                    <TableCell>
                      {canEdit && scheduleEditing ? (
                        <input
                          type="date"
                          value={a.start_date?.slice(0, 10) ?? ""}
                          aria-label="Kezdési dátum"
                          onChange={(e) => updateLocalActivity(a.id, { start_date: e.target.value })}
                          onBlur={async (e) => {
                            const val = e.target.value;
                            if (!val) return;
                            try {
                              await api.updateActivity(id, a.id, { start_date: val });
                              loadActivities();
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
                              loadActivities();
                            }
                          }}
                          className="rounded border border-slate-200 bg-transparent px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.start_date ? new Date(a.start_date).toLocaleDateString("hu-HU") : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.end_date ? new Date(a.end_date).toLocaleDateString("hu-HU") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {a.prerequisite_ids.map((pid) => (
                          <Badge key={pid} variant="secondary" className="gap-1">
                            {activityNameById[pid] || `#${pid}`}
                            {canEdit && scheduleEditing && a.is_active && (
                              <button
                                type="button"
                                onClick={() => removePrerequisite(a.id, pid)}
                                aria-label="Előfeltétel eltávolítása"
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                        {canEdit && scheduleEditing && a.is_active && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="outline" size="icon-xs" aria-label="Előfeltétel hozzáadása" />}
                            >
                              <Plus />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {activities
                                .filter((other) => other.id !== a.id && other.is_active && !a.prerequisite_ids.includes(other.id))
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
                      {canEdit && scheduleEditing ? (
                      <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v as string)}>
                        <SelectTrigger size="sm" className={ACTIVITY_STATUS_COLOR[a.status]}>
                          <SelectValue>
                            {(v: string) => ACTIVITY_STATUS_OPTIONS.find(([val]) => val === v)?.[1] ?? v}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_STATUS_OPTIONS.map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      ) : (
                        <span className={`text-xs font-medium ${ACTIVITY_STATUS_COLOR[a.status]}`}>
                          {ACTIVITY_STATUS_OPTIONS.find(([v]) => v === a.status)?.[1] ?? a.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.is_active ? (
                        canEdit && scheduleEditing ? (
                          <Button variant="link" className="h-auto p-0 text-xs" onClick={() => toggleActivityActive(a)}>
                            Letiltás
                          </Button>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">Aktív</Badge>
                        )
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary">Inaktív</Badge>
                          {canEdit && scheduleEditing && (
                            <Button variant="link" className="h-auto p-0 text-xs" onClick={() => toggleActivityActive(a)}>
                              Aktiválás
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    </>)}
                  </SortableActivityRow>
                ))}
                  </SortableContext>
                </DndContext>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-3">
          <Card className="py-0">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="text-[13px] font-semibold">Dokumentumok</h3>
              <label className={cn(buttonVariants(), "cursor-pointer")}>
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

        <TabsContent value="photos" className="mt-3">
          <Card className="p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold">Fotónapló</h3>
              {canEdit && <PhotoUploadForm onUpload={handlePhotoUpload} />}
            </div>
            {photos.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Nincs feltöltött fotó</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handlePhotoDownload(photo.id)}
                      className="flex aspect-square w-full items-center justify-center bg-slate-50"
                      title="Megnyitás"
                    >
                      <ImageIcon className="size-8 text-slate-300" />
                    </button>
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-slate-700">
                        {new Date(photo.taken_at).toLocaleDateString("hu-HU")}
                      </p>
                      {photo.comment && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{photo.comment}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{photo.uploaded_by_name || "—"} · {formatBytes(photo.file_size)}</p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        aria-label="Fotó törlése"
                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-500 opacity-0 shadow-sm hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="prep" className="mt-3">
          <Card className="p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold">Előkészítés</h3>
              <div className="flex gap-1">
                {([
                  ["all", "Mind"], ["overdue", "Lejárt"], ["today", "Mai"], ["7d", "7 napon belül"], ["14d", "14 napon belül"],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={prepFilter === value ? "default" : "outline"}
                    onClick={() => setPrepFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {(() => {
              const now = new Date();
              const today = now.toISOString().split("T")[0];
              const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString().split("T")[0];
              const in14 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14).toISOString().split("T")[0];
              const prepItems = activities.filter((a) => {
                if (!a.is_active || !a.prep_date) return false;
                const d = a.prep_date.slice(0, 10);
                if (prepFilter === "overdue") return d < today;
                if (prepFilter === "today") return d === today;
                if (prepFilter === "7d") return d >= today && d <= in7;
                if (prepFilter === "14d") return d >= today && d <= in14;
                return true;
              });
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tevékenység</TableHead>
                      <TableHead>Felelős</TableHead>
                      <TableHead>Előkészítés dátuma</TableHead>
                      <TableHead>Kezdés</TableHead>
                      <TableHead>Állapot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prepItems.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-xs">{a.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ROLE_LABELS[a.responsible_role] || a.responsible_role}</TableCell>
                        <TableCell className={cn("text-xs", a.prep_date && a.prep_date.slice(0, 10) < today && "font-semibold text-red-500")}>
                          {a.prep_date ? new Date(a.prep_date).toLocaleDateString("hu-HU") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.start_date ? new Date(a.start_date).toLocaleDateString("hu-HU") : "—"}
                        </TableCell>
                        <TableCell className={`text-xs font-medium ${ACTIVITY_STATUS_COLOR[a.status]}`}>
                          {ACTIVITY_STATUS_OPTIONS.find(([v]) => v === a.status)?.[1] ?? a.status}
                        </TableCell>
                      </TableRow>
                    ))}
                    {prepItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nincs találat</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              );
            })()}
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="mt-3">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Résztvevők</h3>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => { startEdit(); setTab("info"); }}>
                  <Pencil className="size-3.5" /> Szerkesztés
                </Button>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-muted-foreground">Projektmenedzser</dt><dd className="mt-0.5 font-medium">{project.project_manager_name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Építésvezető</dt><dd className="mt-0.5 font-medium">{project.site_manager_name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Beszerzés</dt><dd className="mt-0.5 font-medium">{project.procurement_name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Számlázás</dt><dd className="mt-0.5 font-medium">{project.billing_name || "—"}</dd></div>
            </dl>
            {project.subcontractors && (
              <div className="mt-3 border-t pt-3 text-xs">
                <dt className="text-muted-foreground">Alvállalkozók</dt>
                <dd className="mt-1 whitespace-pre-wrap">{project.subcontractors}</dd>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-3">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Időpont</TableHead>
                  <TableHead>Felhasználó</TableHead>
                  <TableHead>Mező</TableHead>
                  <TableHead>Régi érték</TableHead>
                  <TableHead>Új érték</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("hu-HU")}
                    </TableCell>
                    <TableCell className="text-xs">{entry.user_name || "—"}</TableCell>
                    <TableCell className="text-xs">{entry.field_name}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground" title={entry.old_value ?? undefined}>
                      {entry.old_value ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground" title={entry.new_value ?? undefined}>
                      {entry.new_value ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {auditLog.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nincs napló bejegyzés</TableCell>
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
