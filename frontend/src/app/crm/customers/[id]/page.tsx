"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  api,
  CRM_COMMUNICATION_TYPE_LABELS,
  CRM_CONTRACT_STATUS_LABELS,
  CRM_CUSTOMER_STATUS_COLORS,
  CRM_CUSTOMER_STATUS_LABELS,
  CRM_CUSTOMER_TYPE_LABELS,
  CRM_QUOTE_STATUS_LABELS,
  CRM_TASK_PRIORITY_LABELS,
  CrmCommunicationEvent,
  CrmContract,
  CrmCustomer,
  CrmCustomerRelation,
  CrmDocumentItem,
  CrmQuote,
  CrmTask,
  ProjectCreationFields,
  User,
  UserBrief,
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const STATUS_OPTIONS = Object.entries(CRM_CUSTOMER_STATUS_LABELS) as [string, string][];
const COMM_TYPE_OPTIONS = Object.entries(CRM_COMMUNICATION_TYPE_LABELS) as [string, string][];
const TASK_PRIORITY_OPTIONS = Object.entries(CRM_TASK_PRIORITY_LABELS) as [string, string][];
const QUOTE_STATUS_OPTIONS = Object.entries(CRM_QUOTE_STATUS_LABELS) as [string, string][];
const CONTRACT_STATUS_OPTIONS = Object.entries(CRM_CONTRACT_STATUS_LABELS) as [string, string][];
const emptyCommForm = { type: "phone", date: new Date().toISOString().slice(0, 10), summary: "" };
const emptyTaskForm = { name: "", due_date: "", priority: "normal", owner_id: "" };
const emptyQuoteContent = '{\n  "items": []\n}';

// Local form state keeps every field as a string (controlled inputs) —
// converted to ProjectCreationFields' typed shape only at submit time.
type ProjectFieldsForm = {
  project_code: string;
  settlement: string;
  address: string;
  floor_area_sqm: string;
  delivery_date: string;
  lot_number: string;
};
const emptyProjectFields: ProjectFieldsForm = {
  project_code: "",
  settlement: "",
  address: "",
  floor_area_sqm: "",
  delivery_date: "",
  lot_number: "",
};

function projectFieldsFromForm(form: ProjectFieldsForm): ProjectCreationFields {
  const fields: ProjectCreationFields = {};
  if (form.project_code) fields.project_code = form.project_code;
  if (form.settlement) fields.settlement = form.settlement;
  if (form.address) fields.address = form.address;
  if (form.floor_area_sqm) fields.floor_area_sqm = Number(form.floor_area_sqm);
  if (form.delivery_date) fields.delivery_date = form.delivery_date;
  if (form.lot_number) fields.lot_number = form.lot_number;
  return fields;
}

const emptyContractForm = { start_date: "", end_date: "" };

export default function CrmCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = Number(params.id);

  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [customer, setCustomer] = useState<CrmCustomer | null>(null);
  const [relations, setRelations] = useState<CrmCustomerRelation[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<number, string>>({});
  const [tab, setTab] = useState(searchParams.get("tab") ?? "info");
  const [showRelation, setShowRelation] = useState(false);
  const [relationForm, setRelationForm] = useState({ other_id: "", role_label: "", is_primary: false });
  const [savingRelation, setSavingRelation] = useState(false);

  const [communications, setCommunications] = useState<CrmCommunicationEvent[]>([]);
  const [showComm, setShowComm] = useState(false);
  const [commForm, setCommForm] = useState(emptyCommForm);
  const [savingComm, setSavingComm] = useState(false);

  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [showTask, setShowTask] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [savingTask, setSavingTask] = useState(false);

  const [documents, setDocuments] = useState<CrmDocumentItem[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [quotes, setQuotes] = useState<CrmQuote[]>([]);
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [newQuoteContent, setNewQuoteContent] = useState(emptyQuoteContent);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [versionDialogQuote, setVersionDialogQuote] = useState<CrmQuote | null>(null);
  const [versionContent, setVersionContent] = useState(emptyQuoteContent);
  const [savingVersion, setSavingVersion] = useState(false);
  const [contractDialogQuote, setContractDialogQuote] = useState<CrmQuote | null>(null);
  const [contractFromQuoteForm, setContractFromQuoteForm] = useState(emptyContractForm);
  const [savingContractFromQuote, setSavingContractFromQuote] = useState(false);

  const [contracts, setContracts] = useState<CrmContract[]>([]);
  const [showNewContract, setShowNewContract] = useState(false);
  const [newContractForm, setNewContractForm] = useState(emptyContractForm);
  const [creatingContract, setCreatingContract] = useState(false);

  // Reaching "Megrendelő" (ORDERED) auto-creates the construction project —
  // this dialog collects the project fields only for that transition.
  const [orderedDialogOpen, setOrderedDialogOpen] = useState(false);
  const [orderedForm, setOrderedForm] = useState<ProjectFieldsForm>(emptyProjectFields);
  const [savingOrdered, setSavingOrdered] = useState(false);

  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", email: "", tax_number: "", billing_address: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    api.crmCustomer(customerId).then(setCustomer).catch(() => setCustomer(null));
    api.crmCustomerRelations(customerId).then(setRelations).catch(() => setRelations([]));
    api.crmCommunications(customerId).then(setCommunications).catch(() => setCommunications([]));
    api.crmTasksForCustomer(customerId).then(setTasks).catch(() => setTasks([]));
    api.crmDocumentsFor("customer", customerId).then(setDocuments).catch(() => setDocuments([]));
    api.crmQuotesForCustomer(customerId).then(setQuotes).catch(() => setQuotes([]));
    api.crmContractsForCustomer(customerId).then(setContracts).catch(() => setContracts([]));
  }

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    api.usersDirectory().then(setUsers).catch(() => setUsers([]));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    if (relations.length === 0) return;
    const ids = new Set<number>();
    relations.forEach((r) => {
      ids.add(r.company_customer_id);
      ids.add(r.person_customer_id);
    });
    Promise.all(
      Array.from(ids).map((id) =>
        api.crmCustomer(id).then((c) => [id, c.name] as const).catch(() => [id, `#${id}`] as const)
      )
    ).then((pairs) => setCustomerNames(Object.fromEntries(pairs)));
  }, [relations]);

  async function updateStatus(status: string) {
    if (!customer) return;
    if (status === "ordered" && customer.status !== "ordered") {
      setOrderedForm(emptyProjectFields);
      setOrderedDialogOpen(true);
      return;
    }
    try {
      const updated = await api.updateCrmCustomer(customer.id, { status });
      setCustomer(updated);
      toast.success("Státusz frissítve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function confirmOrderedStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setSavingOrdered(true);
    try {
      const updated = await api.updateCrmCustomer(customer.id, {
        status: "ordered",
        ...projectFieldsFromForm(orderedForm),
      });
      setCustomer(updated);
      setOrderedDialogOpen(false);
      toast.success("Ügyfél megrendelővé váltva — a projekt automatikusan létrejön, ha még nem volt");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSavingOrdered(false);
    }
  }

  function openEditDialog() {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      tax_number: customer.tax_number ?? "",
      billing_address: customer.billing_address ?? "",
    });
    setShowEditCustomer(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = { name: editForm.name };
      if (customer.type !== "person") {
        body.phone = editForm.phone || null;
        body.email = editForm.email || null;
        body.tax_number = editForm.tax_number || null;
        body.billing_address = editForm.billing_address || null;
      }
      const updated = await api.updateCrmCustomer(customer.id, body);
      setCustomer(updated);
      setShowEditCustomer(false);
      toast.success("Ügyfél adatai mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!customer) return;
    try {
      await api.deleteCrmCustomer(customer.id);
      toast.success("Ügyfél törölve");
      router.push("/crm/customers");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nem törölhető — archiválja helyette");
    }
  }

  async function addRelation(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;
    setSavingRelation(true);
    try {
      const otherId = Number(relationForm.other_id);
      const isCompany = customer.type !== "person";
      await api.createCrmCustomerRelation({
        company_customer_id: isCompany ? customer.id : otherId,
        person_customer_id: isCompany ? otherId : customer.id,
        role_label: relationForm.role_label || undefined,
        is_primary: relationForm.is_primary,
      });
      setShowRelation(false);
      setRelationForm({ other_id: "", role_label: "", is_primary: false });
      load();
      toast.success("Kapcsolat létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a kapcsolat létrehozásakor");
    } finally {
      setSavingRelation(false);
    }
  }

  async function removeRelation(id: number) {
    try {
      await api.deleteCrmCustomerRelation(id);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function addCommunication(e: React.FormEvent) {
    e.preventDefault();
    setSavingComm(true);
    try {
      await api.createCrmCommunication({ customer_id: customerId, ...commForm });
      setShowComm(false);
      setCommForm(emptyCommForm);
      load();
      toast.success("Esemény rögzítve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a rögzítés során");
    } finally {
      setSavingComm(false);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setSavingTask(true);
    try {
      const { owner_id, ...rest } = taskForm;
      const body: Record<string, unknown> = { customer_id: customerId, ...rest };
      if (owner_id) body.owner_id = Number(owner_id);
      await api.createCrmTask(body);
      setShowTask(false);
      setTaskForm(emptyTaskForm);
      load();
      toast.success("Feladat létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleTaskDone(task: CrmTask) {
    try {
      await api.updateCrmTask(task.id, { status: task.status === "done" ? "open" : "done" });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

  async function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingDoc(true);
    try {
      await api.uploadCrmDocument("customer", customerId, file);
      load();
      toast.success("Dokumentum feltöltve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a feltöltés során");
    } finally {
      setUploadingDoc(false);
    }
  }

  async function downloadDoc(doc: CrmDocumentItem) {
    try {
      const { url } = await api.downloadCrmDocument(doc.id);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a letöltés során");
    }
  }

  async function deleteDoc(doc: CrmDocumentItem) {
    try {
      await api.deleteCrmDocument(doc.id);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  async function createQuote(e: React.FormEvent) {
    e.preventDefault();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(newQuoteContent);
    } catch {
      toast.error("Érvénytelen JSON az ajánlat tartalmában");
      return;
    }
    setCreatingQuote(true);
    try {
      await api.createCrmQuote(customerId, parsed);
      setShowNewQuote(false);
      setNewQuoteContent(emptyQuoteContent);
      load();
      toast.success("Ajánlat létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingQuote(false);
    }
  }

  async function changeQuoteStatus(quote: CrmQuote, status: string) {
    try {
      await api.updateCrmQuoteStatus(quote.id, status);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

  async function addQuoteVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!versionDialogQuote) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(versionContent);
    } catch {
      toast.error("Érvénytelen JSON");
      return;
    }
    setSavingVersion(true);
    try {
      await api.addCrmQuoteVersion(versionDialogQuote.id, parsed);
      setVersionDialogQuote(null);
      load();
      toast.success("Új verzió mentve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSavingVersion(false);
    }
  }

  async function confirmContractFromQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!contractDialogQuote) return;
    setSavingContractFromQuote(true);
    try {
      await api.createContractFromQuote(
        contractDialogQuote.id,
        contractFromQuoteForm.start_date,
        contractFromQuoteForm.end_date
      );
      setContractDialogQuote(null);
      load();
      toast.success("Szerződés létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a szerződés létrehozásakor");
    } finally {
      setSavingContractFromQuote(false);
    }
  }

  async function createContract(e: React.FormEvent) {
    e.preventDefault();
    setCreatingContract(true);
    try {
      await api.createCrmContract({ customer_id: customerId, ...newContractForm });
      setShowNewContract(false);
      setNewContractForm(emptyContractForm);
      load();
      toast.success("Szerződés létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreatingContract(false);
    }
  }

  async function changeContractStatus(contract: CrmContract, status: string) {
    try {
      await api.updateCrmContractStatus(contract.id, status);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az állapotváltás során");
    }
  }

  if (!customer) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Betöltés…</p>
      </AppLayout>
    );
  }

  const canEdit = me && (me.role === "admin" || me.role === "management" || me.id === customer.owner_id);
  const canDelete = me && (me.role === "admin" || me.role === "management");

  return (
    <AppLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-heading font-bold">{customer.name}</h1>
          <p className="text-xs text-muted-foreground">
            {customer.customer_number} · {CRM_CUSTOMER_TYPE_LABELS[customer.type] ?? customer.type}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={CRM_CUSTOMER_STATUS_COLORS[customer.status] ?? ""}>
            {CRM_CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
          </Badge>
          {canEdit && (
            <Button variant="outline" onClick={openEditDialog}>Szerkesztés</Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" className="border-warning text-warning-foreground hover:bg-warning-bg" />}>
                Törlés
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Biztosan törlöd ezt az ügyfelet?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Csak akkor törölhető, ha nincs hozzá kapcsolódó rekord (ajánlat, szerződés,
                    kommunikáció, feladat, kapcsolat). Ha van, archiválja inkább a státusz módosításával.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Mégse</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                    Törlés
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
        <TabsList>
          <TabsTrigger value="info">Áttekintés</TabsTrigger>
          <TabsTrigger value="relations">Kapcsolatok</TabsTrigger>
          <TabsTrigger value="quotes">Ajánlatok</TabsTrigger>
          <TabsTrigger value="contracts">Szerződések</TabsTrigger>
          <TabsTrigger value="communications">Kommunikáció</TabsTrigger>
          <TabsTrigger value="tasks">Feladatok</TabsTrigger>
          <TabsTrigger value="documents">Dokumentumok</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Dialog open={showEditCustomer} onOpenChange={setShowEditCustomer}>
            <DialogContent>
              <form onSubmit={saveEdit}>
                <DialogHeader>
                  <DialogTitle>Ügyfél szerkesztése</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name">Név</Label>
                    <Input id="edit-name" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  {customer.type === "person" ? (
                    <p className="text-xs text-muted-foreground">
                      Magánszemély ügyfélnél a rendszer kizárólag a nevet tárolja — további elérhetőség nem adható meg.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-phone">Telefon</Label>
                        <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-email">E-mail</Label>
                        <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-tax">Adószám</Label>
                        <Input id="edit-tax" value={editForm.tax_number} onChange={(e) => setEditForm({ ...editForm, tax_number: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-billing">Számlázási cím</Label>
                        <Input id="edit-billing" value={editForm.billing_address} onChange={(e) => setEditForm({ ...editForm, billing_address: e.target.value })} />
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingEdit}>{savingEdit ? "Mentés..." : "Mentés"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={orderedDialogOpen} onOpenChange={setOrderedDialogOpen}>
            <DialogContent>
              <form onSubmit={confirmOrderedStatus}>
                <DialogHeader>
                  <DialogTitle>Megrendelővé váltás — projekt adatai</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    A projekt adatai csak akkor szükségesek, ha az ügyfélhez még nincs projekt — ekkor a
                    rendszer automatikusan létrehozza az ütemtervvel együtt.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="ord-code">Projektazonosító</Label>
                    <Input id="ord-code" value={orderedForm.project_code} onChange={(e) => setOrderedForm({ ...orderedForm, project_code: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ord-settlement">Település</Label>
                    <Input id="ord-settlement" value={orderedForm.settlement} onChange={(e) => setOrderedForm({ ...orderedForm, settlement: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ord-address">Cím</Label>
                    <Input id="ord-address" value={orderedForm.address} onChange={(e) => setOrderedForm({ ...orderedForm, address: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ord-area">Alapterület (nettó m²)</Label>
                    <Input id="ord-area" type="number" value={orderedForm.floor_area_sqm} onChange={(e) => setOrderedForm({ ...orderedForm, floor_area_sqm: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ord-delivery">Átadási határidő</Label>
                    <Input id="ord-delivery" type="date" value={orderedForm.delivery_date} onChange={(e) => setOrderedForm({ ...orderedForm, delivery_date: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingOrdered}>{savingOrdered ? "Mentés..." : "Megrendelővé váltás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="max-w-lg space-y-3 p-4">
            {canEdit && (
              <div className="space-y-1.5">
                <Label>Státusz</Label>
                <Select value={customer.status} onValueChange={(v) => updateStatus(v as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => CRM_CUSTOMER_STATUS_LABELS[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Felelős ügyintéző</dt>
              <dd>{users.find((u) => u.id === customer.owner_id)?.full_name ?? `#${customer.owner_id}`}</dd>
              {customer.phone && (
                <>
                  <dt className="text-muted-foreground">Telefon</dt>
                  <dd>{customer.phone}</dd>
                </>
              )}
              {customer.email && (
                <>
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd>{customer.email}</dd>
                </>
              )}
              {customer.tax_number && (
                <>
                  <dt className="text-muted-foreground">Adószám</dt>
                  <dd>{customer.tax_number}</dd>
                </>
              )}
              {customer.billing_address && (
                <>
                  <dt className="text-muted-foreground">Számlázási cím</dt>
                  <dd>{customer.billing_address}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Létrehozva</dt>
              <dd>{new Date(customer.created_at).toLocaleString("hu-HU")}</dd>
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="relations" className="mt-4">
          <div className="mb-3">
            <Button onClick={() => setShowRelation(true)}>Új kapcsolat</Button>
          </div>

          <Dialog open={showRelation} onOpenChange={setShowRelation}>
            <DialogContent>
              <form onSubmit={addRelation}>
                <DialogHeader>
                  <DialogTitle>
                    Új kapcsolat — {customer.type === "person" ? "céghez" : "magánszemélyhez"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="other-id">
                      {customer.type === "person" ? "Cég azonosító (customer id)" : "Magánszemély azonosító (customer id)"}
                    </Label>
                    <Input
                      id="other-id"
                      type="number"
                      required
                      value={relationForm.other_id}
                      onChange={(e) => setRelationForm({ ...relationForm, other_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role-label">Szerepkör (pl. kapcsolattartó)</Label>
                    <Input
                      id="role-label"
                      value={relationForm.role_label}
                      onChange={(e) => setRelationForm({ ...relationForm, role_label: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingRelation}>
                    {savingRelation ? "Mentés..." : "Létrehozás"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="divide-y divide-border">
            {relations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nincs rögzített kapcsolat</p>
            )}
            {relations.map((r) => {
              const otherId = r.company_customer_id === customer.id ? r.person_customer_id : r.company_customer_id;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="font-medium">{customerNames[otherId] ?? `#${otherId}`}</span>
                    {r.role_label && <span className="ml-2 text-muted-foreground">({r.role_label})</span>}
                    {r.is_primary && <Badge className="ml-2 bg-accent-100 text-accent-700">Elsődleges</Badge>}
                  </div>
                  <Button variant="link" className="h-auto p-0 text-destructive" onClick={() => removeRelation(r.id)}>
                    Eltávolítás
                  </Button>
                </div>
              );
            })}
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <div className="mb-3">
            <Button onClick={() => setShowNewQuote(true)}>Új ajánlat</Button>
          </div>

          <Dialog open={showNewQuote} onOpenChange={setShowNewQuote}>
            <DialogContent>
              <form onSubmit={createQuote}>
                <DialogHeader>
                  <DialogTitle>Új ajánlat</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="quote-content">Tartalom (JSON)</Label>
                    <Textarea id="quote-content" rows={6} value={newQuoteContent} onChange={(e) => setNewQuoteContent(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingQuote}>{creatingQuote ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={!!versionDialogQuote} onOpenChange={(open) => !open && setVersionDialogQuote(null)}>
            <DialogContent>
              <form onSubmit={addQuoteVersion}>
                <DialogHeader>
                  <DialogTitle>Új verzió — {versionDialogQuote?.quote_number}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="version-content">Tartalom (JSON)</Label>
                    <Textarea id="version-content" rows={6} value={versionContent} onChange={(e) => setVersionContent(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingVersion}>{savingVersion ? "Mentés..." : "Mentés"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={!!contractDialogQuote} onOpenChange={(open) => !open && setContractDialogQuote(null)}>
            <DialogContent>
              <form onSubmit={confirmContractFromQuote}>
                <DialogHeader>
                  <DialogTitle>Szerződés létrehozása — {contractDialogQuote?.quote_number}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cfq-start">Kezdő dátum</Label>
                    <Input id="cfq-start" type="date" required value={contractFromQuoteForm.start_date} onChange={(e) => setContractFromQuoteForm({ ...contractFromQuoteForm, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cfq-end">Lejárati dátum</Label>
                    <Input id="cfq-end" type="date" required value={contractFromQuoteForm.end_date} onChange={(e) => setContractFromQuoteForm({ ...contractFromQuoteForm, end_date: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingContractFromQuote}>{savingContractFromQuote ? "Mentés..." : "Szerződés létrehozása"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="divide-y divide-border">
            {quotes.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nincs ajánlat</p>
            )}
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{q.quote_number} <span className="font-normal text-muted-foreground">v{q.current_version}</span></p>
                  <p className="text-xs text-muted-foreground">{new Date(q.date).toLocaleDateString("hu-HU")}</p>
                </div>
                <Button variant="link" className="h-auto shrink-0 p-0" onClick={() => { setVersionDialogQuote(q); setVersionContent(JSON.stringify(q.versions[q.versions.length - 1]?.content_json ?? {}, null, 2)); }}>
                  Új verzió
                </Button>
                <Select value={q.status} onValueChange={(v) => changeQuoteStatus(q, v as string)}>
                  <SelectTrigger size="sm" className="w-36 shrink-0">
                    <SelectValue>{(v: string) => CRM_QUOTE_STATUS_LABELS[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STATUS_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {q.status === "accepted" && (
                  <Button
                    variant="link"
                    className="h-auto shrink-0 p-0"
                    onClick={() => { setContractDialogQuote(q); setContractFromQuoteForm(emptyContractForm); }}
                  >
                    Szerződés létrehozása
                  </Button>
                )}
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <div className="mb-3">
            <Button onClick={() => setShowNewContract(true)}>Új szerződés</Button>
          </div>

          <Dialog open={showNewContract} onOpenChange={setShowNewContract}>
            <DialogContent>
              <form onSubmit={createContract}>
                <DialogHeader>
                  <DialogTitle>Új szerződés</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-start">Kezdő dátum</Label>
                    <Input id="contract-start" type="date" required value={newContractForm.start_date} onChange={(e) => setNewContractForm({ ...newContractForm, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contract-end">Lejárati dátum</Label>
                    <Input id="contract-end" type="date" required value={newContractForm.end_date} onChange={(e) => setNewContractForm({ ...newContractForm, end_date: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creatingContract}>{creatingContract ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="divide-y divide-border">
            {contracts.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nincs szerződés</p>
            )}
            {contracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.contract_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.start_date).toLocaleDateString("hu-HU")} – {new Date(c.end_date).toLocaleDateString("hu-HU")}
                  </p>
                </div>
                <Select value={c.status} onValueChange={(v) => changeContractStatus(c, v as string)}>
                  <SelectTrigger size="sm" className="w-36 shrink-0">
                    <SelectValue>{(v: string) => CRM_CONTRACT_STATUS_LABELS[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUS_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="mt-4">
          <div className="mb-3">
            <Button onClick={() => setShowComm(true)}>Új esemény</Button>
          </div>

          <Dialog open={showComm} onOpenChange={setShowComm}>
            <DialogContent>
              <form onSubmit={addCommunication}>
                <DialogHeader>
                  <DialogTitle>Kommunikációs esemény rögzítése</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label>Típus</Label>
                    <Select value={commForm.type} onValueChange={(v) => setCommForm({ ...commForm, type: v as string })}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(v: string) => CRM_COMMUNICATION_TYPE_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {COMM_TYPE_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comm-date">Dátum</Label>
                    <Input id="comm-date" type="date" required value={commForm.date} onChange={(e) => setCommForm({ ...commForm, date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comm-summary">Rövid összefoglaló</Label>
                    <Textarea id="comm-summary" required rows={3} value={commForm.summary} onChange={(e) => setCommForm({ ...commForm, summary: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingComm}>{savingComm ? "Mentés..." : "Rögzítés"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="divide-y divide-border">
            {communications.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nincs rögzített esemény</p>
            )}
            {communications.map((c) => (
              <div key={c.id} className="p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{CRM_COMMUNICATION_TYPE_LABELS[c.type] ?? c.type}</span>
                  <span className="text-xs text-muted-foreground">{new Date(c.date).toLocaleDateString("hu-HU")}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{c.summary}</p>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="mb-3">
            <Button onClick={() => setShowTask(true)}>Új feladat</Button>
          </div>

          <Dialog open={showTask} onOpenChange={setShowTask}>
            <DialogContent>
              <form onSubmit={addTask}>
                <DialogHeader>
                  <DialogTitle>Új feladat</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="task-name">Feladat neve</Label>
                    <Input id="task-name" required value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-due">Határidő</Label>
                    <Input id="task-due" type="date" required value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioritás</Label>
                    <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v as string })}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{(v: string) => CRM_TASK_PRIORITY_LABELS[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITY_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {me && (me.role === "admin" || me.role === "management") && (
                    <div className="space-y-1.5">
                      <Label>Felelős</Label>
                      <Select value={taskForm.owner_id} onValueChange={(v) => setTaskForm({ ...taskForm, owner_id: v as string })}>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string) => users.find((u) => String(u.id) === v)?.full_name ?? "Válassz felelőst"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={savingTask}>{savingTask ? "Mentés..." : "Létrehozás"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="divide-y divide-border">
            {tasks.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nincs feladat</p>
            )}
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <span className={t.status === "done" ? "font-medium line-through text-muted-foreground" : "font-medium"}>
                    {t.name}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {CRM_TASK_PRIORITY_LABELS[t.priority] ?? t.priority} · {new Date(t.due_date).toLocaleDateString("hu-HU")}
                  </span>
                </div>
                <Button variant="link" className="h-auto p-0" onClick={() => toggleTaskDone(t)}>
                  {t.status === "done" ? "Újranyitás" : "Lezárás"}
                </Button>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="mb-3">
            <Label
              className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              aria-disabled={uploadingDoc}
            >
              {uploadingDoc ? "Feltöltés..." : "Dokumentum feltöltése"}
              <input type="file" className="hidden" onChange={handleDocFile} disabled={uploadingDoc} />
            </Label>
          </div>

          <Card className="divide-y divide-border">
            {documents.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nincs dokumentum</p>
            )}
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <span className="font-medium">{d.original_filename}</span>
                  <span className="ml-2 text-xs text-muted-foreground">v{d.version} · {(d.file_size / 1024).toFixed(0)} KB</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="link" className="h-auto p-0" onClick={() => downloadDoc(d)}>Letöltés</Button>
                  <Button variant="link" className="h-auto p-0 text-destructive" onClick={() => deleteDoc(d)}>Törlés</Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
