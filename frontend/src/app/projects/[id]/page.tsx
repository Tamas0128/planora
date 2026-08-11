"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BellRing, Calendar, Download, GripVertical, Image as ImageIcon, MessageSquareText, NotebookPen, Pencil, Plus, QrCode, Upload, X } from "lucide-react";
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
  CashFlowSummary,
  CATEGORY_LABELS,
  CrmContract,
  CUSTOMER_INVOICE_STATUS_LABELS,
  CustomerInvoice,
  DocumentTemplate,
  DOCUMENT_FAMILY_LABELS,
  OwnCompany,
  DOCUMENTATION_SUBTYPE_LABELS,
  downloadFile,
  GENERATED_DOCUMENT_STATUS_COLORS,
  GENERATED_DOCUMENT_STATUS_LABELS,
  GeneratedDocument,
  getCachedUser,
  Partner,
  ProjectDetail,
  ProjectDocument,
  ProjectPhoto,
  ROLE_LABELS,
  STATUS_LABELS,
  SUBCONTRACTOR_CONTRACT_STATUS_LABELS,
  SUBCONTRACTOR_INVOICE_STATUS_LABELS,
  SubcontractorContract,
  SubcontractorInvoice,
  Tig,
  TIG_DOCUMENT_SUBTYPE_LABELS,
  TIG_STATUS_LABELS,
  User,
  UserBrief,
  VAT_TYPE_LABELS,
} from "@/lib/api";
import { CATEGORY_ORDER, DOCUMENTATION_SUBTYPE_ORDER } from "@/lib/project-utils";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

// "closed" (Lezárva) deliberately excluded — that's the separate "Lezárás"
// button/function (admin/management/project_manager only), not a value
// anyone with canEdit can pick from this general dropdown.
const STATUS_OPTIONS: [string, string][] = [
  ["waiting", "Várakozik"],
  ["planning", "Tervezés alatt"],
  ["foundation", "Alapozás"],
  ["structure", "Szerkezetállítás"],
  ["exterior_done", "Kívülről kész"],
  ["turnkey", "Kulcsrakész"],
];

const PHASE_DEADLINE_FIELDS: [string, string][] = [
  ["planning_deadline", "Tervezés határideje"],
  ["foundation_deadline", "Alapozás határideje"],
  ["structure_deadline", "Szerkezetállítás határideje"],
  ["exterior_done_deadline", "Kívülről kész határideje"],
  ["turnkey_deadline", "Kulcsrakész határideje"],
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
const CATEGORY_OPTIONS = CATEGORY_ORDER.map((c) => [c, CATEGORY_LABELS[c]] as [string, string]);
const DOCUMENTATION_SUBTYPE_OPTIONS = DOCUMENTATION_SUBTYPE_ORDER.map(
  (s) => [s, DOCUMENTATION_SUBTYPE_LABELS[s]] as [string, string],
);

const ACTIVITY_STATUS_COLOR: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-accent-700",
  done: "text-neutral-800",
  blocked: "text-critical",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function formatHuf(value?: string | number | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toLocaleString("hu-HU")} Ft` : String(value);
}

const VAT_TYPE_OPTIONS = Object.entries(VAT_TYPE_LABELS) as [string, string][];
const TIG_STATUS_OPTIONS = Object.entries(TIG_STATUS_LABELS) as [string, string][];
const SUBCONTRACTOR_CONTRACT_STATUS_OPTIONS = Object.entries(SUBCONTRACTOR_CONTRACT_STATUS_LABELS) as [string, string][];
const TIG_DOCUMENT_SUBTYPE_OPTIONS = Object.entries(TIG_DOCUMENT_SUBTYPE_LABELS) as [string, string][];
const SUBCONTRACTOR_INVOICE_STATUS_OPTIONS = Object.entries(SUBCONTRACTOR_INVOICE_STATUS_LABELS) as [string, string][];
const CUSTOMER_INVOICE_STATUS_OPTIONS = Object.entries(CUSTOMER_INVOICE_STATUS_LABELS) as [string, string][];

const emptyPartnerForm = { name: "", tax_number: "", phone: "", email: "" };
const emptyTigForm = {
  partner_id: "", subcontractor_contract_id: "", date: new Date().toISOString().slice(0, 10),
  period_start: "", period_end: "", net_value: "", vat_type: "standard_27", note: "",
};
const emptySubcontractorContractForm = {
  partner_id: "", own_company_id: "", contract_type: "", scope_of_work: "", value: "", vat_type: "standard_27",
  currency: "HUF", payment_terms_days: "", payment_method: "",
  start_date: "", end_date: "", effective_date: "",
};
const emptySubcontractorInvoiceForm = {
  partner_id: "", tig_id: "none", invoice_number: "",
  performance_date: "", issue_date: "", due_date: "", net_value: "", vat_type: "standard_27",
};
const emptyCustomerInvoiceForm = {
  performance_date: "", issue_date: "", due_date: "", net_value: "", vat_type: "standard_27",
};

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
          "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
          canEdit && "cursor-pointer hover:border-primary",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static/local asset
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground/60" />
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
          className="block h-8 rounded border border-border bg-transparent px-2 text-xs focus:border-primary focus:outline-none"
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
      className="cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
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
      className={cn(!activity.is_active && "bg-muted opacity-50", isDragging && "relative z-10 shadow-md")}
    >
      {children(dragHandle)}
    </TableRow>
  );
}

function ActivityNotesCell({
  notes, canEdit, onSave,
}: {
  notes?: string; canEdit: boolean; onSave: (notes: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setDraft(notes ?? ""); }}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={notes ? "Jegyzet megtekintése/szerkesztése" : "Jegyzet hozzáadása"}
            className={cn(notes ? "text-primary" : "text-muted-foreground/60")}
          />
        }
      >
        <NotebookPen className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        {canEdit ? (
          <>
            <Textarea
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Jegyzet a feladathoz…"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { onSave(draft); setOpen(false); }}>Mentés</Button>
            </div>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground/80">{notes || "Nincs jegyzet"}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ActivityExtrasCell({
  statusText, reminderDate, canEdit, onSave,
}: {
  statusText?: string; reminderDate?: string; canEdit: boolean; onSave: (statusText: string, reminderDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStatusText, setDraftStatusText] = useState(statusText ?? "");
  const [draftReminderDate, setDraftReminderDate] = useState(reminderDate ?? "");
  const hasValue = !!statusText || !!reminderDate;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setDraftStatusText(statusText ?? "");
          setDraftReminderDate(reminderDate ?? "");
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={hasValue ? "Szöveges státusz / emlékeztető megtekintése" : "Szöveges státusz / emlékeztető hozzáadása"}
            className={cn(hasValue ? "text-primary" : "text-muted-foreground/60")}
          />
        }
      >
        <BellRing className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        {canEdit ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Szöveges státusz</Label>
              <Input
                value={draftStatusText}
                onChange={(e) => setDraftStatusText(e.target.value)}
                placeholder="Opcionális, szabad szöveg…"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Emlékeztető</Label>
              <Input
                type="date"
                value={draftReminderDate}
                onChange={(e) => setDraftReminderDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { onSave(draftStatusText, draftReminderDate); setOpen(false); }}>Mentés</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground/80">{statusText || "Nincs szöveges státusz"}</p>
            <p className="text-sm text-foreground/80">
              Emlékeztető: {reminderDate ? new Date(reminderDate).toLocaleDateString("hu-HU") : "nincs beállítva"}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
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
    "info" | "schedule" | "documents" | "photos" | "prep" | "participants" | "log" | "finance"
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
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [newActivityForm, setNewActivityForm] = useState({
    name: "", duration_days: 1, prep_days: 14, responsible_role: "project_manager", assignee_id: "none",
    category: "other", documentation_subtype: undefined as string | undefined, notes: "",
    status_text: "", reminder_date: "",
  });

  const [partners, setPartners] = useState<Partner[]>([]);
  const [ownCompanies, setOwnCompanies] = useState<OwnCompany[]>([]);
  const [tigs, setTigs] = useState<Tig[]>([]);
  const [subcontractorInvoices, setSubcontractorInvoices] = useState<SubcontractorInvoice[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [showNewPartner, setShowNewPartner] = useState(false);
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm);
  const [showNewTig, setShowNewTig] = useState(false);
  const [creatingTig, setCreatingTig] = useState(false);
  const [tigForm, setTigForm] = useState(emptyTigForm);
  const [subcontractorContracts, setSubcontractorContracts] = useState<SubcontractorContract[]>([]);
  const [showNewSubContract, setShowNewSubContract] = useState(false);
  const [creatingSubContract, setCreatingSubContract] = useState(false);
  const [subContractForm, setSubContractForm] = useState(emptySubcontractorContractForm);
  const [customerContracts, setCustomerContracts] = useState<CrmContract[]>([]);
  const [generatedDocuments, setGeneratedDocuments] = useState<GeneratedDocument[]>([]);
  const [showGenerateDoc, setShowGenerateDoc] = useState(false);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [generateDocForm, setGenerateDocForm] = useState({
    family: "tig", source_id: "", doc_subtype: "normal", delay_reason: "", template_id: "",
  });
  const [genTemplateOptions, setGenTemplateOptions] = useState<DocumentTemplate[]>([]);
  const [showNewSubInvoice, setShowNewSubInvoice] = useState(false);
  const [creatingSubInvoice, setCreatingSubInvoice] = useState(false);
  const [subInvoiceForm, setSubInvoiceForm] = useState(emptySubcontractorInvoiceForm);
  const [showNewCustInvoice, setShowNewCustInvoice] = useState(false);
  const [creatingCustInvoice, setCreatingCustInvoice] = useState(false);
  const [custInvoiceForm, setCustInvoiceForm] = useState(emptyCustomerInvoiceForm);
  const [editingFinance, setEditingFinance] = useState(false);
  const [financeForm, setFinanceForm] = useState({ contract_net_value: "", contract_vat_type: "standard_27" });
  const [savingFinance, setSavingFinance] = useState(false);
  const [partiallyPaidPrompt, setPartiallyPaidPrompt] = useState<CustomerInvoice | null>(null);
  const [partiallyPaidAmount, setPartiallyPaidAmount] = useState("");

  function loadProject() {
    api.project(id).then((p) => { setProject(p); setDeliveryDate(p.delivery_date); }).catch(console.error);
  }
  function loadActivities() {
    api.activities(id).then(setActivities).catch(console.error);
  }
  function loadDocuments() {
    api.documents(id).then(setDocuments).catch(console.error);
  }
  function loadGeneratedDocuments() {
    api.projectGeneratedDocuments(id).then(setGeneratedDocuments).catch(() => setGeneratedDocuments([]));
  }
  function loadPhotos() {
    api.photos(id).then(setPhotos).catch(console.error);
  }
  function loadAuditLog() {
    api.auditLogs(id).then(setAuditLog).catch(console.error);
  }
  function loadFinance() {
    api.financePartners().then(setPartners).catch(() => setPartners([]));
    api.financeTigs(id).then(setTigs).catch(() => setTigs([]));
    api.financeSubcontractorContracts(id).then(setSubcontractorContracts).catch(() => setSubcontractorContracts([]));
    api.financeSubcontractorInvoices(id).then(setSubcontractorInvoices).catch(() => setSubcontractorInvoices([]));
    api.financeCustomerInvoices(id).then(setCustomerInvoices).catch(() => setCustomerInvoices([]));
    api.financeCashFlow(id).then(setCashFlow).catch(() => setCashFlow(null));
  }

  useEffect(() => {
    if (!id) return;
    loadProject();
    loadActivities();
    loadDocuments();
    loadPhotos();
    loadAuditLog();
    loadFinance();
    loadGeneratedDocuments();
    api.me().then(setMe).catch(() => setMe(null));
    api.users().then(setUsers).catch(() => setUsers([]));
    api.usersDirectory().then(setAssignableUsers).catch(() => setAssignableUsers([]));
    api.listOwnCompanies(true).then(setOwnCompanies).catch(() => setOwnCompanies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Ügyfél-szerződés dokumentumokhoz a CRM Contract lista kell — csak akkor
  // tölthető, ha a projekthez már van CRM ügyfél kapcsolva. Ha nincs, a
  // dialog nem enged tetszőleges (más ügyfélhez tartozó) szerződést
  // választani innen — az a dokumentum project_id nélkül jönne létre, és
  // soha nem jelenne meg ennek a projektnek a listáján, csak az ügyfél CRM
  // adatlapján, ami megtévesztő ("elindult, de nem látszik" élmény).
  useEffect(() => {
    if (!project?.customer_id) {
      setCustomerContracts([]);
      return;
    }
    api.crmContractsForCustomer(project.customer_id).then(setCustomerContracts).catch(() => setCustomerContracts([]));
  }, [project?.customer_id]);

  // A generálás-dialog sablonválasztójához: aktív sablonok a kiválasztott
  // dokumentumcsaládhoz, hogy a rendszer automatikus (épülettípus/csúszás
  // alapú) választása helyett kézzel is kijelölhető legyen egy konkrét
  // sablon (services/document_templates.py::select_template megkerülése).
  useEffect(() => {
    if (!showGenerateDoc) return;
    api.listDocumentTemplates(generateDocForm.family, true).then(setGenTemplateOptions).catch(() => setGenTemplateOptions([]));
  }, [showGenerateDoc, generateDocForm.family]);

  // Amíg van "pending" státuszú generált dokumentum (PDF-konverzió fut a
  // háttérben), pár másodpercenként újratöltjük a listát, amíg készen nem
  // lesz (vagy hiba nem történik).
  useEffect(() => {
    if (!generatedDocuments.some((d) => d.status === "pending")) return;
    const timer = setTimeout(loadGeneratedDocuments, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedDocuments]);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "project_manager" || me?.role === "site_manager";
  // Lezárás is a separate, more restricted function than the rest of the
  // status pipeline — site_manager/procurement/billing/subcontractor never
  // see or use it, even if they can otherwise edit this project.
  const canClose = me?.role === "admin" || me?.role === "management" || me?.role === "project_manager";
  const canEditFinance = me?.role === "admin" || me?.role === "management" || me?.role === "billing";
  const canEditTig = canEditFinance || (me?.role === "project_manager" && project?.project_manager_id === me?.id);

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    setCreatingPartner(true);
    try {
      const partner = await api.createFinancePartner({
        name: partnerForm.name,
        tax_number: partnerForm.tax_number || undefined,
        phone: partnerForm.phone || undefined,
        email: partnerForm.email || undefined,
      });
      setShowNewPartner(false);
      setPartnerForm(emptyPartnerForm);
      await api.financePartners().then(setPartners);
      setTigForm((f) => ({ ...f, partner_id: String(partner.id) }));
      setSubInvoiceForm((f) => ({ ...f, partner_id: String(partner.id) }));
      toast.success("Partner létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingPartner(false);
    }
  }

  async function saveFinance(e: React.FormEvent) {
    e.preventDefault();
    setSavingFinance(true);
    try {
      await api.updateProjectFinance(id, {
        contract_net_value: financeForm.contract_net_value || undefined,
        contract_vat_type: financeForm.contract_vat_type,
      });
      setEditingFinance(false);
      loadProject();
      loadFinance();
      toast.success("Pénzügyi adatok mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSavingFinance(false);
    }
  }

  async function createTig(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTig(true);
    try {
      await api.createFinanceTig(id, {
        partner_id: Number(tigForm.partner_id),
        subcontractor_contract_id: tigForm.subcontractor_contract_id ? Number(tigForm.subcontractor_contract_id) : undefined,
        date: tigForm.date,
        period_start: tigForm.period_start,
        period_end: tigForm.period_end,
        net_value: tigForm.net_value,
        vat_type: tigForm.vat_type,
        note: tigForm.note || undefined,
      });
      setShowNewTig(false);
      setTigForm(emptyTigForm);
      loadFinance();
      toast.success("TIG létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingTig(false);
    }
  }

  async function changeTigStatus(tig: Tig, status: string) {
    try {
      await api.updateFinanceTigStatus(id, tig.id, status);
      loadFinance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

  async function createSubcontractorContract(e: React.FormEvent) {
    e.preventDefault();
    setCreatingSubContract(true);
    try {
      await api.createFinanceSubcontractorContract(id, {
        partner_id: Number(subContractForm.partner_id),
        own_company_id: subContractForm.own_company_id ? Number(subContractForm.own_company_id) : undefined,
        contract_type: subContractForm.contract_type || undefined,
        scope_of_work: subContractForm.scope_of_work || undefined,
        value: subContractForm.value || undefined,
        vat_type: subContractForm.value ? subContractForm.vat_type : undefined,
        currency: subContractForm.currency,
        payment_terms_days: subContractForm.payment_terms_days ? Number(subContractForm.payment_terms_days) : undefined,
        payment_method: subContractForm.payment_method || undefined,
        start_date: subContractForm.start_date,
        end_date: subContractForm.end_date,
        effective_date: subContractForm.effective_date || undefined,
      });
      setShowNewSubContract(false);
      setSubContractForm(emptySubcontractorContractForm);
      loadFinance();
      toast.success("Alvállalkozói szerződés létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingSubContract(false);
    }
  }

  async function changeSubcontractorContractStatus(contract: SubcontractorContract, status: string) {
    try {
      await api.updateFinanceSubcontractorContractStatus(id, contract.id, status);
      loadFinance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

  async function createSubcontractorInvoice(e: React.FormEvent) {
    e.preventDefault();
    setCreatingSubInvoice(true);
    try {
      await api.createFinanceSubcontractorInvoice(id, {
        partner_id: Number(subInvoiceForm.partner_id),
        tig_id: subInvoiceForm.tig_id === "none" ? undefined : Number(subInvoiceForm.tig_id),
        invoice_number: subInvoiceForm.invoice_number,
        performance_date: subInvoiceForm.performance_date,
        issue_date: subInvoiceForm.issue_date,
        due_date: subInvoiceForm.due_date,
        net_value: subInvoiceForm.net_value,
        vat_type: subInvoiceForm.vat_type,
      });
      setShowNewSubInvoice(false);
      setSubInvoiceForm(emptySubcontractorInvoiceForm);
      loadFinance();
      toast.success("Alvállalkozói számla létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingSubInvoice(false);
    }
  }

  async function changeSubcontractorInvoiceStatus(invoice: SubcontractorInvoice, status: string) {
    try {
      await api.updateFinanceSubcontractorInvoiceStatus(id, invoice.id, status);
      loadFinance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

  async function createCustomerInvoice(e: React.FormEvent) {
    e.preventDefault();
    setCreatingCustInvoice(true);
    try {
      await api.createFinanceCustomerInvoice(id, {
        performance_date: custInvoiceForm.performance_date,
        issue_date: custInvoiceForm.issue_date,
        due_date: custInvoiceForm.due_date,
        net_value: custInvoiceForm.net_value,
        vat_type: custInvoiceForm.vat_type,
      });
      setShowNewCustInvoice(false);
      setCustInvoiceForm(emptyCustomerInvoiceForm);
      loadFinance();
      toast.success("Ügyfél számla létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingCustInvoice(false);
    }
  }

  async function changeCustomerInvoiceStatus(invoice: CustomerInvoice, status: string) {
    if (status === "partially_paid") {
      setPartiallyPaidAmount(invoice.paid_amount ?? "");
      setPartiallyPaidPrompt(invoice);
      return;
    }
    try {
      await api.updateFinanceCustomerInvoiceStatus(id, invoice.id, status);
      loadFinance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

  async function confirmPartiallyPaid(e: React.FormEvent) {
    e.preventDefault();
    if (!partiallyPaidPrompt) return;
    try {
      await api.updateFinanceCustomerInvoiceStatus(
        id, partiallyPaidPrompt.id, "partially_paid", partiallyPaidAmount || undefined
      );
      setPartiallyPaidPrompt(null);
      loadFinance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

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
      client_phone_2: project.client_phone_2 || "",
      client_email_2: project.client_email_2 || "",
      building_type: project.building_type,
      floor_area_sqm: project.floor_area_sqm,
      delivery_date: project.delivery_date,
      status: project.status,
      planning_deadline: project.planning_deadline || "",
      foundation_deadline: project.foundation_deadline || "",
      structure_deadline: project.structure_deadline || "",
      exterior_done_deadline: project.exterior_done_deadline || "",
      turnkey_deadline: project.turnkey_deadline || "",
      project_manager_id: project.project_manager_id ?? "",
      site_manager_id: project.site_manager_id ?? "",
      procurement_id: project.procurement_id ?? "",
      billing_id: project.billing_id ?? "",
      subcontractors: project.subcontractors || "",
      status_text: project.status_text || "",
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
      for (const [key] of PHASE_DEADLINE_FIELDS) {
        if (payload[key] === "") payload[key] = null;
      }
      for (const key of ["lot_number", "client_phone", "client_email", "client_phone_2", "client_email_2", "subcontractors", "status_text"]) {
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

  const generateDocSources: { value: string; label: string }[] =
    generateDocForm.family === "tig"
      ? tigs.map((t) => ({
          value: String(t.id),
          label: `${partners.find((p) => p.id === t.partner_id)?.name ?? `Partner #${t.partner_id}`} · ${new Date(t.date).toLocaleDateString("hu-HU")}`,
        }))
      : generateDocForm.family === "subcontractor_contract"
        ? subcontractorContracts.map((c) => ({
            value: String(c.id),
            label: `${partners.find((p) => p.id === c.partner_id)?.name ?? `Partner #${c.partner_id}`} · ${c.contract_number}`,
          }))
        : customerContracts.map((c) => ({ value: String(c.id), label: c.contract_number }));

  async function handleGenerateDocument(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingDoc(true);
    try {
      await api.generateDocument({
        family: generateDocForm.family,
        source_id: Number(generateDocForm.source_id),
        doc_subtype: generateDocForm.family === "tig" ? generateDocForm.doc_subtype : undefined,
        delay_reason: generateDocForm.delay_reason || undefined,
        template_id: generateDocForm.template_id ? Number(generateDocForm.template_id) : undefined,
      });
      setShowGenerateDoc(false);
      setGenerateDocForm({ family: "tig", source_id: "", doc_subtype: "normal", delay_reason: "", template_id: "" });
      loadGeneratedDocuments();
      toast.success("Dokumentum generálása elindult");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a generálás során");
    } finally {
      setGeneratingDoc(false);
    }
  }

  async function handleDownloadGeneratedDocument(docId: number, format: "docx" | "pdf") {
    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error("A böngésző blokkolta a felugró ablakot. Engedélyezd a felugró ablakokat ehhez az oldalhoz, majd próbáld újra.");
      return;
    }
    try {
      const { url } = await api.downloadGeneratedDocument(docId, format);
      tab.location.href = url;
    } catch (err) {
      tab.close();
      toast.error(err instanceof Error ? err.message : "Hiba a letöltés során");
    }
  }

  async function handleDeleteGeneratedDocument(docId: number) {
    try {
      await api.deleteGeneratedDocument(docId);
      loadGeneratedDocuments();
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

  async function commitActivityNotes(activityId: number, notes: string) {
    try {
      await api.updateActivity(id, activityId, { notes: notes || null });
      loadActivities();
      toast.success("Jegyzet mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function commitActivityExtras(activityId: number, statusText: string, reminderDate: string) {
    try {
      await api.updateActivity(id, activityId, {
        status_text: statusText || null,
        reminder_date: reminderDate || null,
      });
      loadActivities();
      toast.success("Mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
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

  async function deleteActivity(activityId: number) {
    try {
      await api.deleteActivity(id, activityId);
      loadActivities();
      loadProject();
      toast.success("Feladat törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function createActivity(e: React.FormEvent) {
    e.preventDefault();
    setCreatingActivity(true);
    try {
      await api.createActivity(id, {
        ...newActivityForm,
        assignee_id: newActivityForm.assignee_id === "none" ? null : Number(newActivityForm.assignee_id),
        status_text: newActivityForm.status_text || null,
        reminder_date: newActivityForm.reminder_date || null,
      });
      setShowNewActivity(false);
      setNewActivityForm({ name: "", duration_days: 1, prep_days: 14, responsible_role: "project_manager", assignee_id: "none", category: "other", documentation_subtype: undefined, notes: "", status_text: "", reminder_date: "" });
      loadActivities();
      loadProject();
      toast.success("Feladat létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingActivity(false);
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

  async function handleCloseProject() {
    try {
      await api.updateProject(id, { status: "closed" });
      loadProject();
      toast.success("Projekt lezárva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a lezárás során");
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
            <h1 className="text-lg font-heading font-bold text-foreground">{project.name}</h1>
            <p className="text-xs text-muted-foreground">
              {project.project_code} · {project.settlement}
            </p>
          </div>
        </div>
        {/* Inline delivery date */}
        <Card className="flex items-center gap-3 px-3 py-2 shadow-sm">
          <Calendar className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                className="mt-0.5 block rounded border border-border bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none"
              />
            ) : (
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
              </p>
            )}
          </div>
          <div className="ml-4 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Készültség</p>
            <p className="mt-0.5 text-sm font-bold text-primary">{project.completion_percent}%</p>
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
          <TabsTrigger value="finance">Pénzügy</TabsTrigger>
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
                      render={<Button variant="outline" className="border-warning text-warning-foreground hover:bg-warning-bg" />}
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
                  {canClose && project.status !== "closed" && (
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="outline" />}>
                        Lezárás
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Biztosan lezárod ezt a projektet?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A &quot;{project.name}&quot; projekt Lezárva státuszba kerül. Ez egy külön,
                            csak vezetői/projektmenedzseri funkció — a projekt adatai megmaradnak.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Mégse</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCloseProject}>
                            Lezárás
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Készültség</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">{project.completion_percent}%</p>
                </Card>
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mai feladatok</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {activities.filter((a) => a.is_active && a.start_date?.slice(0, 10) === new Date().toISOString().split("T")[0]).length}
                  </p>
                </Card>
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Késő feladatok</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">
                    {activities.filter((a) => a.is_active && a.prep_date && a.prep_date < new Date().toISOString().split("T")[0] && a.status !== "done").length}
                  </p>
                </Card>
                <Card className="p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dok. / Fotó</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">{documents.length} / {photos.length}</p>
                </Card>
              </div>

              {project.status_text && (
                <Card className="mb-3 flex items-start gap-2 p-3">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">Szöveges státusz</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-foreground/80">{project.status_text}</p>
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
                    {project.client_phone_2 && (
                      <div className="flex justify-between"><dt className="text-muted-foreground">Telefon 2</dt><dd>{project.client_phone_2}</dd></div>
                    )}
                    {project.client_email_2 && (
                      <div className="flex justify-between"><dt className="text-muted-foreground">E-mail 2</dt><dd>{project.client_email_2}</dd></div>
                    )}
                  </dl>
                </Card>
                <Card className="p-3">
                  <h3 className="mb-2 text-[13px] font-semibold">Fázis határidők</h3>
                  <dl className="space-y-1.5 text-xs">
                    {PHASE_DEADLINE_FIELDS.map(([key, label]) => {
                      const value = (project as unknown as Record<string, string | undefined>)[key];
                      const late = !!value && value < new Date().toISOString().split("T")[0];
                      return (
                        <div key={key} className="flex justify-between">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className={late ? "font-semibold text-destructive" : undefined}>
                            {value ? new Date(value).toLocaleDateString("hu-HU") : "—"}
                          </dd>
                        </div>
                      );
                    })}
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
                    <Label htmlFor="client_phone_2">Ügyfél telefon 2</Label>
                    <Input
                      id="client_phone_2"
                      value={form.client_phone_2 as string}
                      onChange={(e) => setForm({ ...form, client_phone_2: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client_email_2">Ügyfél e-mail 2</Label>
                    <Input
                      id="client_email_2"
                      type="email"
                      value={form.client_email_2 as string}
                      onChange={(e) => setForm({ ...form, client_email_2: e.target.value })}
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
                  <h3 className="mb-2 text-[13px] font-semibold">Fázis határidők</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {PHASE_DEADLINE_FIELDS.map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={key}>{label}</Label>
                        <Input
                          id={key}
                          type="date"
                          value={form[key] as string}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        />
                      </div>
                    ))}
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
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="project-status-text">Szöveges státusz</Label>
                    <Input
                      id="project-status-text"
                      placeholder="Opcionális, szabad szöveg…"
                      value={form.status_text as string}
                      onChange={(e) => setForm({ ...form, status_text: e.target.value })}
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
            <p className="text-xs text-muted-foreground">{activities.length} tevékenység</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleGanttPdf}>
                <Download className="size-3.5" />
                Gantt PDF
              </Button>
              {canEdit && (
                <Button size="sm" onClick={() => setShowNewActivity(true)}>
                  <Plus className="size-3.5" /> Új feladat
                </Button>
              )}
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
                  <TableHead className="min-w-[70px]">Jegyzet</TableHead>
                  <TableHead className="min-w-[70px]">Extra</TableHead>
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
                          className="rounded border border-border bg-transparent px-1 py-0.5 text-xs focus:border-primary focus:outline-none"
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
                      <ActivityNotesCell
                        notes={a.notes}
                        canEdit={!!canEdit && scheduleEditing}
                        onSave={(notes) => commitActivityNotes(a.id, notes)}
                      />
                    </TableCell>
                    <TableCell>
                      <ActivityExtrasCell
                        statusText={a.status_text}
                        reminderDate={a.reminder_date}
                        canEdit={!!canEdit && scheduleEditing}
                        onSave={(statusText, reminderDate) => commitActivityExtras(a.id, statusText, reminderDate)}
                      />
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
                      <div className="flex items-center gap-1.5">
                        {a.is_active ? (
                          canEdit && scheduleEditing ? (
                            <Button variant="link" className="h-auto p-0 text-xs" onClick={() => toggleActivityActive(a)}>
                              Letiltás
                            </Button>
                          ) : (
                            <Badge className="bg-accent-100 text-accent-700">Aktív</Badge>
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
                        {canEdit && scheduleEditing && (
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={<Button variant="link" className="h-auto p-0 text-xs text-destructive" />}
                            >
                              Törlés
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Biztosan törlöd ezt a feladatot?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  &quot;{a.name}&quot; archiválásra kerül és eltűnik az ütemtervből. Az adatai megmaradnak,
                                  de nem jelenik meg többé.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Mégse</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteActivity(a.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  Törlés
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                    </>)}
                  </SortableActivityRow>
                ))}
                  </SortableContext>
                </DndContext>
                {activities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={14} className="py-8 text-center text-muted-foreground">
                      Nincs feladat ehhez a projekthez
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Dialog open={showNewActivity} onOpenChange={(v) => { setShowNewActivity(v); if (!v) setNewActivityForm({ name: "", duration_days: 1, prep_days: 14, responsible_role: "project_manager", assignee_id: "none", category: "other", documentation_subtype: undefined, notes: "", status_text: "", reminder_date: "" }); }}>
            <DialogContent>
              <form onSubmit={createActivity}>
                <DialogHeader>
                  <DialogTitle>Új feladat</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-activity-name">Feladat neve</Label>
                    <Input
                      id="new-activity-name"
                      required
                      value={newActivityForm.name}
                      onChange={(e) => setNewActivityForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kategória</Label>
                    <Select
                      value={newActivityForm.category}
                      onValueChange={(v) => setNewActivityForm((f) => ({ ...f, category: v as string, documentation_subtype: v === "documentation" ? f.documentation_subtype : undefined }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{(v: string) => CATEGORY_LABELS[v] || v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newActivityForm.category === "documentation" && (
                    <div className="space-y-1.5">
                      <Label>Dokumentáció altípusa</Label>
                      <Select
                        value={newActivityForm.documentation_subtype ?? ""}
                        onValueChange={(v) => setNewActivityForm((f) => ({ ...f, documentation_subtype: v as string }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>{(v: string) => DOCUMENTATION_SUBTYPE_LABELS[v] || "Válassz altípust"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENTATION_SUBTYPE_OPTIONS.map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Felelős</Label>
                    <Select
                      value={newActivityForm.responsible_role}
                      onValueChange={(v) => setNewActivityForm((f) => ({ ...f, responsible_role: v as string }))}
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
                    <Label>Kijelölve</Label>
                    <Select
                      value={newActivityForm.assignee_id}
                      onValueChange={(v) => setNewActivityForm((f) => ({ ...f, assignee_id: v as string }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {() => assignableUsers.find((u) => String(u.id) === newActivityForm.assignee_id)?.full_name ?? "Nincs kijelölve"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nincs kijelölve</SelectItem>
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-activity-duration">Futási idő (nap)</Label>
                    <Input
                      id="new-activity-duration"
                      type="number"
                      min={1}
                      required
                      value={newActivityForm.duration_days}
                      onChange={(e) => setNewActivityForm((f) => ({ ...f, duration_days: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-activity-prep">Előkészítési idő (nap)</Label>
                    <Input
                      id="new-activity-prep"
                      type="number"
                      min={1}
                      required
                      value={newActivityForm.prep_days}
                      onChange={(e) => setNewActivityForm((f) => ({ ...f, prep_days: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-activity-status-text">Szöveges státusz</Label>
                    <Input
                      id="new-activity-status-text"
                      placeholder="Opcionális, szabad szöveg…"
                      value={newActivityForm.status_text}
                      onChange={(e) => setNewActivityForm((f) => ({ ...f, status_text: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-activity-reminder">Emlékeztető</Label>
                    <Input
                      id="new-activity-reminder"
                      type="date"
                      value={newActivityForm.reminder_date}
                      onChange={(e) => setNewActivityForm((f) => ({ ...f, reminder_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-activity-notes">Jegyzet</Label>
                    <Textarea
                      id="new-activity-notes"
                      rows={3}
                      value={newActivityForm.notes}
                      onChange={(e) => setNewActivityForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingActivity}>
                    {creatingActivity ? "Mentés..." : "Létrehozás"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="documents" className="mt-3 space-y-4">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Dokumentum generálás</h3>
              {canEditTig && (
                <Button size="sm" variant="outline" onClick={() => setShowGenerateDoc(true)}>
                  <Plus className="size-3.5" /> Generálás
                </Button>
              )}
            </div>
            <div className="divide-y divide-border">
              {generatedDocuments.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">Nincs generált dokumentum</p>
              )}
              {generatedDocuments.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {DOCUMENT_FAMILY_LABELS[doc.family] ?? doc.family}
                      {doc.family === "tig" && ` · ${TIG_DOCUMENT_SUBTYPE_LABELS[doc.doc_subtype] ?? doc.doc_subtype}`}
                      {" · v"}{doc.version}
                    </p>
                    <p className="text-muted-foreground">{new Date(doc.created_at).toLocaleString("hu-HU")}</p>
                  </div>
                  <Badge className={cn("text-xs", GENERATED_DOCUMENT_STATUS_COLORS[doc.status])}>
                    {GENERATED_DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                  </Badge>
                  <Button variant="link" className="h-auto p-0" onClick={() => handleDownloadGeneratedDocument(doc.id, "docx")}>
                    Word
                  </Button>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    disabled={!doc.has_pdf}
                    onClick={() => handleDownloadGeneratedDocument(doc.id, "pdf")}
                  >
                    PDF
                  </Button>
                  {me?.role === "admin" && (
                    <Button variant="link" className="h-auto p-0 text-destructive" onClick={() => handleDeleteGeneratedDocument(doc.id)}>
                      Törlés
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Dialog open={showGenerateDoc} onOpenChange={setShowGenerateDoc}>
            <DialogContent>
              <form onSubmit={handleGenerateDocument}>
                <DialogHeader><DialogTitle>Dokumentum generálása</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label>Dokumentumcsalád</Label>
                    <Select
                      value={generateDocForm.family}
                      onValueChange={(v) => setGenerateDocForm({ ...generateDocForm, family: v as string, source_id: "", template_id: "" })}
                    >
                      <SelectTrigger><SelectValue>{(v: string) => DOCUMENT_FAMILY_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tig">{DOCUMENT_FAMILY_LABELS.tig}</SelectItem>
                        <SelectItem value="subcontractor_contract">{DOCUMENT_FAMILY_LABELS.subcontractor_contract}</SelectItem>
                        <SelectItem value="client_contract">{DOCUMENT_FAMILY_LABELS.client_contract}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {generateDocForm.family === "tig" && (
                    <div className="space-y-1.5">
                      <Label>Altípus</Label>
                      <Select value={generateDocForm.doc_subtype} onValueChange={(v) => setGenerateDocForm({ ...generateDocForm, doc_subtype: v as string })}>
                        <SelectTrigger><SelectValue>{(v: string) => TIG_DOCUMENT_SUBTYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {TIG_DOCUMENT_SUBTYPE_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {generateDocForm.family === "client_contract" && !project.customer_id ? (
                    <p className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                      Ehhez a projekthez nincs CRM ügyfél kötve, ezért innen nem generálható ügyfél-szerződés
                      dokumentum — a projekt itt nem tudná megjeleníteni, mert nincs hozzá kapcsolva. Nyisd meg az
                      ügyfél CRM adatlapját (Ügyfelek → a szerződés → Szerződések tab), ott a szerződéshez
                      közvetlenül generálhatod.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Forrás</Label>
                      <Select value={generateDocForm.source_id} onValueChange={(v) => setGenerateDocForm({ ...generateDocForm, source_id: v as string })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Válasszon rekordot">
                            {(v: string) => generateDocSources.find((s) => s.value === v)?.label ?? v}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {generateDocSources.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      {generateDocSources.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">Nincs ehhez választható rekord.</p>
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Sablon</Label>
                    <Select
                      value={generateDocForm.template_id || "auto"}
                      onValueChange={(v) => setGenerateDocForm({ ...generateDocForm, template_id: v === "auto" ? "" : (v as string) })}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string) =>
                            v === "auto"
                              ? "Automatikus (rendszer választja)"
                              : (genTemplateOptions.find((t) => String(t.id) === v)?.name ?? v)
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatikus (rendszer választja)</SelectItem>
                        {genTemplateOptions.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name} · v{t.version}
                            {t.building_type ? ` · ${BUILDING_LABELS[t.building_type] ?? t.building_type}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Automatikus esetén a rendszer épülettípus és csúszás-kockázat alapján választ sablont — itt felülbírálható.
                    </p>
                  </div>
                  {generateDocForm.family === "tig" && generateDocForm.doc_subtype === "normal" && project.delay_risk !== "ok" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="generate-delay-reason">Csúszás indoklása</Label>
                      <Textarea
                        id="generate-delay-reason"
                        value={generateDocForm.delay_reason}
                        onChange={(e) => setGenerateDocForm({ ...generateDocForm, delay_reason: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={generatingDoc || !generateDocForm.source_id}>
                    {generatingDoc ? "Generálás..." : "Generálás"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

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
                  <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => handlePhotoDownload(photo.id)}
                      className="flex aspect-square w-full items-center justify-center bg-muted"
                      title="Megnyitás"
                    >
                      <ImageIcon className="size-8 text-muted-foreground/60" />
                    </button>
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-foreground/80">
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
                        className="absolute right-1 top-1 rounded-full bg-card/90 p-1 text-muted-foreground opacity-0 shadow-sm hover:text-destructive group-hover:opacity-100"
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
                        <TableCell className={cn("text-xs", a.prep_date && a.prep_date.slice(0, 10) < today && "font-semibold text-destructive")}>
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

        <TabsContent value="finance" className="mt-3 space-y-4">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Szerződés</h3>
              {canEditFinance && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFinanceForm({
                      contract_net_value: project.contract_net_value || "",
                      contract_vat_type: project.contract_vat_type || "standard_27",
                    });
                    setEditingFinance(true);
                  }}
                >
                  <Pencil className="size-3.5" /> Szerkesztés
                </Button>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Nettó érték</dt><dd className="mt-0.5 font-medium">{formatHuf(project.contract_net_value)}</dd></div>
              <div><dt className="text-muted-foreground">ÁFA típus</dt><dd className="mt-0.5 font-medium">{project.contract_vat_type ? (VAT_TYPE_LABELS[project.contract_vat_type] ?? project.contract_vat_type) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Bruttó érték</dt><dd className="mt-0.5 font-medium">{formatHuf(project.contract_gross_value)}</dd></div>
            </dl>
          </Card>

          <Dialog open={editingFinance} onOpenChange={setEditingFinance}>
            <DialogContent>
              <form onSubmit={saveFinance}>
                <DialogHeader><DialogTitle>Szerződés szerkesztése</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-net">Nettó érték (Ft)</Label>
                    <Input id="contract-net" type="number" min="0" step="1" value={financeForm.contract_net_value} onChange={(e) => setFinanceForm({ ...financeForm, contract_net_value: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ÁFA típus</Label>
                    <Select value={financeForm.contract_vat_type} onValueChange={(v) => setFinanceForm({ ...financeForm, contract_vat_type: v as string })}>
                      <SelectTrigger><SelectValue>{(v: string) => VAT_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {VAT_TYPE_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingFinance}>{savingFinance ? "Mentés..." : "Mentés"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="p-3">
            <h3 className="mb-2 text-[13px] font-semibold">Cash flow</h3>
            {cashFlow ? (
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Kiszámlázott (bruttó)</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.invoiced_gross)}</dd></div>
                <div><dt className="text-muted-foreground">Beérkezett</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.received_gross)}</dd></div>
                <div><dt className="text-muted-foreground">Kintlévőség</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.outstanding_receivable)}</dd></div>
                <div><dt className="text-muted-foreground">TIG összesen (nettó)</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.tig_total_net)}</dd></div>
                <div><dt className="text-muted-foreground">Alvállalkozói (bruttó)</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.subcontractor_invoiced_gross)}</dd></div>
                <div><dt className="text-muted-foreground">Kifizetett alvállalkozói</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.subcontractor_paid_gross)}</dd></div>
                <div><dt className="text-muted-foreground">Fizetendő kötelezettség</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.payable_obligations)}</dd></div>
                <div><dt className="text-muted-foreground">Cash flow egyenleg</dt><dd className={cn("mt-0.5 font-medium", Number(cashFlow.cash_flow_balance) < 0 && "text-destructive")}>{formatHuf(cashFlow.cash_flow_balance)}</dd></div>
                <div><dt className="text-muted-foreground">Várható fedezet</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.expected_margin)}</dd></div>
                <div><dt className="text-muted-foreground">Aktuális fedezet</dt><dd className="mt-0.5 font-medium">{formatHuf(cashFlow.actual_margin)}</dd></div>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">Nincs adat</p>
            )}
          </Card>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Partnerek</h3>
              {canEditFinance && (
                <Button size="sm" variant="outline" onClick={() => setShowNewPartner(true)}>
                  <Plus className="size-3.5" /> Új partner
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {partners.length === 0 && <p className="text-xs text-muted-foreground">Nincs partner</p>}
              {partners.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>
              ))}
            </div>
          </Card>

          <Dialog open={showNewPartner} onOpenChange={setShowNewPartner}>
            <DialogContent>
              <form onSubmit={createPartner}>
                <DialogHeader><DialogTitle>Új partner</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-name">Név</Label>
                    <Input id="partner-name" required value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-tax">Adószám</Label>
                    <Input id="partner-tax" value={partnerForm.tax_number} onChange={(e) => setPartnerForm({ ...partnerForm, tax_number: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-phone">Telefon</Label>
                    <Input id="partner-phone" value={partnerForm.phone} onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="partner-email">E-mail</Label>
                    <Input id="partner-email" type="email" value={partnerForm.email} onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingPartner}>{creatingPartner ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">TIG-ek (teljesítésigazolások)</h3>
              {canEditTig && (
                <Button size="sm" variant="outline" onClick={() => setShowNewTig(true)} disabled={partners.length === 0}>
                  <Plus className="size-3.5" /> Új TIG
                </Button>
              )}
            </div>
            <div className="divide-y divide-border">
              {tigs.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nincs TIG</p>}
              {tigs.map((t) => {
                const partner = partners.find((p) => p.id === t.partner_id);
                return (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{partner?.name ?? `Partner #${t.partner_id}`}</p>
                      <p className="text-muted-foreground">
                        {new Date(t.period_start).toLocaleDateString("hu-HU")} – {new Date(t.period_end).toLocaleDateString("hu-HU")}
                        {" · "}{formatHuf(t.net_value)} nettó / {formatHuf(t.gross_value)} bruttó
                      </p>
                      <p className={cn("mt-0.5", t.invoice_count === 0 ? "text-warning-foreground" : "text-muted-foreground")}>
                        {t.invoice_count === 0 ? "Nincs hozzá számla" : `${t.invoice_count} kapcsolt számla · felhasznált: ${formatHuf(t.consumed_amount)}`}
                      </p>
                    </div>
                    <Select value={t.status} onValueChange={(v) => changeTigStatus(t, v as string)} disabled={!canEditTig}>
                      <SelectTrigger size="sm" className="w-36 shrink-0">
                        <SelectValue>{(v: string) => TIG_STATUS_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {TIG_STATUS_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </Card>

          <Dialog open={showNewTig} onOpenChange={setShowNewTig}>
            <DialogContent>
              <form onSubmit={createTig}>
                <DialogHeader><DialogTitle>Új TIG</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label>Partner</Label>
                    <Select value={tigForm.partner_id} onValueChange={(v) => setTigForm({ ...tigForm, partner_id: v as string, subcontractor_contract_id: "" })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Válasszon partnert">
                          {(v: string) => partners.find((p) => String(p.id) === v)?.name ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kapcsolódó szerződés</Label>
                    <Select value={tigForm.subcontractor_contract_id || "none"} onValueChange={(v) => setTigForm({ ...tigForm, subcontractor_contract_id: v === "none" ? "" : (v as string) })}>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string) => (v === "none" ? "Nincs (eseti munka)" : subcontractorContracts.find((c) => String(c.id) === v)?.contract_number ?? v)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nincs (eseti munka)</SelectItem>
                        {subcontractorContracts
                          .filter((c) => !tigForm.partner_id || c.partner_id === Number(tigForm.partner_id))
                          .map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.contract_number}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tig-date">Dátum</Label>
                    <Input id="tig-date" type="date" required value={tigForm.date} onChange={(e) => setTigForm({ ...tigForm, date: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tig-period-start">Időszak kezdete</Label>
                      <Input id="tig-period-start" type="date" required value={tigForm.period_start} onChange={(e) => setTigForm({ ...tigForm, period_start: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tig-period-end">Időszak vége</Label>
                      <Input id="tig-period-end" type="date" required value={tigForm.period_end} onChange={(e) => setTigForm({ ...tigForm, period_end: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tig-net">Nettó érték (Ft)</Label>
                    <Input id="tig-net" type="number" min="0" step="1" required value={tigForm.net_value} onChange={(e) => setTigForm({ ...tigForm, net_value: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ÁFA típus</Label>
                    <Select value={tigForm.vat_type} onValueChange={(v) => setTigForm({ ...tigForm, vat_type: v as string })}>
                      <SelectTrigger><SelectValue>{(v: string) => VAT_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {VAT_TYPE_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tig-note">Megjegyzés</Label>
                    <Textarea id="tig-note" value={tigForm.note} onChange={(e) => setTigForm({ ...tigForm, note: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingTig || !tigForm.partner_id}>{creatingTig ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Alvállalkozói szerződések</h3>
              {canEditTig && (
                <Button size="sm" variant="outline" onClick={() => setShowNewSubContract(true)} disabled={partners.length === 0}>
                  <Plus className="size-3.5" /> Új szerződés
                </Button>
              )}
            </div>
            <div className="divide-y divide-border">
              {subcontractorContracts.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nincs alvállalkozói szerződés</p>}
              {subcontractorContracts.map((c) => {
                const partner = partners.find((p) => p.id === c.partner_id);
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{partner?.name ?? `Partner #${c.partner_id}`} · {c.contract_number}</p>
                      <p className="text-muted-foreground">
                        {new Date(c.start_date).toLocaleDateString("hu-HU")} – {new Date(c.end_date).toLocaleDateString("hu-HU")}
                        {c.value && <>{" · "}{formatHuf(c.value)}</>}
                      </p>
                      {c.scope_of_work && <p className="mt-0.5 text-muted-foreground">{c.scope_of_work}</p>}
                    </div>
                    <Select value={c.status} onValueChange={(v) => changeSubcontractorContractStatus(c, v as string)} disabled={!canEditTig}>
                      <SelectTrigger size="sm" className="w-32 shrink-0">
                        <SelectValue>{(v: string) => SUBCONTRACTOR_CONTRACT_STATUS_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SUBCONTRACTOR_CONTRACT_STATUS_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </Card>

          <Dialog open={showNewSubContract} onOpenChange={setShowNewSubContract}>
            <DialogContent>
              <form onSubmit={createSubcontractorContract}>
                <DialogHeader><DialogTitle>Új alvállalkozói szerződés</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label>Partner</Label>
                    <Select value={subContractForm.partner_id} onValueChange={(v) => setSubContractForm({ ...subContractForm, partner_id: v as string })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Válasszon partnert">
                          {(v: string) => partners.find((p) => String(p.id) === v)?.name ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Megrendelő (saját cég)</Label>
                    <Select value={subContractForm.own_company_id || "none"} onValueChange={(v) => setSubContractForm({ ...subContractForm, own_company_id: v === "none" ? "" : (v as string) })}>
                      <SelectTrigger>
                        <SelectValue>{(v: string) => (v === "none" ? "Nincs megadva" : ownCompanies.find((c) => String(c.id) === v)?.name ?? v)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nincs megadva</SelectItem>
                        {ownCompanies.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subcontract-type">Szerződés típusa</Label>
                    <Input id="subcontract-type" value={subContractForm.contract_type} onChange={(e) => setSubContractForm({ ...subContractForm, contract_type: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subcontract-scope">A szerződés tárgya</Label>
                    <Textarea id="subcontract-scope" value={subContractForm.scope_of_work} onChange={(e) => setSubContractForm({ ...subContractForm, scope_of_work: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="subcontract-start">Kezdete</Label>
                      <Input id="subcontract-start" type="date" required value={subContractForm.start_date} onChange={(e) => setSubContractForm({ ...subContractForm, start_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subcontract-end">Vége</Label>
                      <Input id="subcontract-end" type="date" required value={subContractForm.end_date} onChange={(e) => setSubContractForm({ ...subContractForm, end_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subcontract-effective">Hatálybalépés</Label>
                      <Input id="subcontract-effective" type="date" value={subContractForm.effective_date} onChange={(e) => setSubContractForm({ ...subContractForm, effective_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subcontract-value">Nettó szerződéses érték (Ft)</Label>
                    <Input id="subcontract-value" type="number" min="0" step="1" value={subContractForm.value} onChange={(e) => setSubContractForm({ ...subContractForm, value: e.target.value })} />
                  </div>
                  {subContractForm.value && (
                    <div className="space-y-1.5">
                      <Label>ÁFA típus</Label>
                      <Select value={subContractForm.vat_type} onValueChange={(v) => setSubContractForm({ ...subContractForm, vat_type: v as string })}>
                        <SelectTrigger><SelectValue>{(v: string) => VAT_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {VAT_TYPE_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="subcontract-payment-days">Fizetési határidő (nap)</Label>
                      <Input id="subcontract-payment-days" type="number" min="0" step="1" value={subContractForm.payment_terms_days} onChange={(e) => setSubContractForm({ ...subContractForm, payment_terms_days: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subcontract-payment-method">Fizetési mód</Label>
                      <Input id="subcontract-payment-method" value={subContractForm.payment_method} onChange={(e) => setSubContractForm({ ...subContractForm, payment_method: e.target.value })} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingSubContract || !subContractForm.partner_id}>{creatingSubContract ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Alvállalkozói számlák</h3>
              {canEditFinance && (
                <Button size="sm" variant="outline" onClick={() => setShowNewSubInvoice(true)} disabled={partners.length === 0}>
                  <Plus className="size-3.5" /> Új számla
                </Button>
              )}
            </div>
            <div className="divide-y divide-border">
              {subcontractorInvoices.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nincs alvállalkozói számla</p>}
              {subcontractorInvoices.map((inv) => {
                const partner = partners.find((p) => p.id === inv.partner_id);
                const overdue = inv.due_date < todayIsoDate() && !inv.payment_date;
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{inv.invoice_number} · {partner?.name ?? `Partner #${inv.partner_id}`}</p>
                      <p className={cn(overdue ? "text-destructive" : "text-muted-foreground")}>
                        Határidő: {new Date(inv.due_date).toLocaleDateString("hu-HU")}
                        {" · "}{formatHuf(inv.net_value)} nettó / {formatHuf(inv.gross_value)} bruttó
                        {!inv.tig_id && " · nincs TIG"}
                      </p>
                    </div>
                    <Select value={inv.status} onValueChange={(v) => changeSubcontractorInvoiceStatus(inv, v as string)} disabled={!canEditFinance}>
                      <SelectTrigger size="sm" className="w-36 shrink-0">
                        <SelectValue>{(v: string) => SUBCONTRACTOR_INVOICE_STATUS_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SUBCONTRACTOR_INVOICE_STATUS_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </Card>

          <Dialog open={showNewSubInvoice} onOpenChange={setShowNewSubInvoice}>
            <DialogContent>
              <form onSubmit={createSubcontractorInvoice}>
                <DialogHeader><DialogTitle>Új alvállalkozói számla</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label>Partner</Label>
                    <Select value={subInvoiceForm.partner_id} onValueChange={(v) => setSubInvoiceForm({ ...subInvoiceForm, partner_id: v as string })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Válasszon partnert">
                          {(v: string) => partners.find((p) => String(p.id) === v)?.name ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kapcsolódó TIG (opcionális)</Label>
                    <Select value={subInvoiceForm.tig_id} onValueChange={(v) => setSubInvoiceForm({ ...subInvoiceForm, tig_id: v as string })}>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string) => {
                            if (v === "none") return "Nincs";
                            const t = tigs.find((tt) => String(tt.id) === v);
                            return t
                              ? `${new Date(t.period_start).toLocaleDateString("hu-HU")} – ${new Date(t.period_end).toLocaleDateString("hu-HU")}`
                              : v;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nincs</SelectItem>
                        {tigs.filter((t) => String(t.partner_id) === subInvoiceForm.partner_id).map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {new Date(t.period_start).toLocaleDateString("hu-HU")} – {new Date(t.period_end).toLocaleDateString("hu-HU")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-inv-number">Számlaszám</Label>
                    <Input id="sub-inv-number" required value={subInvoiceForm.invoice_number} onChange={(e) => setSubInvoiceForm({ ...subInvoiceForm, invoice_number: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sub-inv-perf">Teljesítés</Label>
                      <Input id="sub-inv-perf" type="date" required value={subInvoiceForm.performance_date} onChange={(e) => setSubInvoiceForm({ ...subInvoiceForm, performance_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sub-inv-issue">Kiállítás</Label>
                      <Input id="sub-inv-issue" type="date" required value={subInvoiceForm.issue_date} onChange={(e) => setSubInvoiceForm({ ...subInvoiceForm, issue_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sub-inv-due">Fizetési hat.</Label>
                      <Input id="sub-inv-due" type="date" required value={subInvoiceForm.due_date} onChange={(e) => setSubInvoiceForm({ ...subInvoiceForm, due_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-inv-net">Nettó összeg (Ft)</Label>
                    <Input id="sub-inv-net" type="number" min="0" step="1" required value={subInvoiceForm.net_value} onChange={(e) => setSubInvoiceForm({ ...subInvoiceForm, net_value: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ÁFA típus</Label>
                    <Select value={subInvoiceForm.vat_type} onValueChange={(v) => setSubInvoiceForm({ ...subInvoiceForm, vat_type: v as string })}>
                      <SelectTrigger><SelectValue>{(v: string) => VAT_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {VAT_TYPE_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingSubInvoice || !subInvoiceForm.partner_id}>{creatingSubInvoice ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Ügyfél számlák</h3>
              {canEditFinance && (
                <Button size="sm" variant="outline" onClick={() => setShowNewCustInvoice(true)}>
                  <Plus className="size-3.5" /> Új számla
                </Button>
              )}
            </div>
            <div className="divide-y divide-border">
              {customerInvoices.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nincs ügyfél számla</p>}
              {customerInvoices.map((inv) => {
                const overdue = inv.due_date < todayIsoDate() && !inv.payment_received_date;
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{inv.invoice_number} · {inv.customer_name ?? "Nincs megrendelő"}</p>
                      <p className={cn(overdue ? "text-destructive" : "text-muted-foreground")}>
                        Határidő: {new Date(inv.due_date).toLocaleDateString("hu-HU")}
                        {" · "}{formatHuf(inv.net_value)} nettó / {formatHuf(inv.gross_value)} bruttó
                      </p>
                    </div>
                    <Select value={inv.status} onValueChange={(v) => changeCustomerInvoiceStatus(inv, v as string)} disabled={!canEditFinance}>
                      <SelectTrigger size="sm" className="w-40 shrink-0">
                        <SelectValue>{(v: string) => CUSTOMER_INVOICE_STATUS_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_INVOICE_STATUS_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </Card>

          <Dialog open={showNewCustInvoice} onOpenChange={setShowNewCustInvoice}>
            <DialogContent>
              <form onSubmit={createCustomerInvoice}>
                <DialogHeader><DialogTitle>Új ügyfél számla</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-inv-perf">Teljesítés</Label>
                      <Input id="cust-inv-perf" type="date" required value={custInvoiceForm.performance_date} onChange={(e) => setCustInvoiceForm({ ...custInvoiceForm, performance_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-inv-issue">Kiállítás</Label>
                      <Input id="cust-inv-issue" type="date" required value={custInvoiceForm.issue_date} onChange={(e) => setCustInvoiceForm({ ...custInvoiceForm, issue_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cust-inv-due">Fizetési hat.</Label>
                      <Input id="cust-inv-due" type="date" required value={custInvoiceForm.due_date} onChange={(e) => setCustInvoiceForm({ ...custInvoiceForm, due_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cust-inv-net">Nettó összeg (Ft)</Label>
                    <Input id="cust-inv-net" type="number" min="0" step="1" required value={custInvoiceForm.net_value} onChange={(e) => setCustInvoiceForm({ ...custInvoiceForm, net_value: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ÁFA típus</Label>
                    <Select value={custInvoiceForm.vat_type} onValueChange={(v) => setCustInvoiceForm({ ...custInvoiceForm, vat_type: v as string })}>
                      <SelectTrigger><SelectValue>{(v: string) => VAT_TYPE_LABELS[v] ?? v}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {VAT_TYPE_OPTIONS.map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingCustInvoice}>{creatingCustInvoice ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={!!partiallyPaidPrompt} onOpenChange={(open) => !open && setPartiallyPaidPrompt(null)}>
            <DialogContent>
              <form onSubmit={confirmPartiallyPaid}>
                <DialogHeader><DialogTitle>Részben kiegyenlített összeg</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="partial-amount">Befizetett összeg (Ft)</Label>
                    <Input id="partial-amount" type="number" min="0" step="1" value={partiallyPaidAmount} onChange={(e) => setPartiallyPaidAmount(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Mentés</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
