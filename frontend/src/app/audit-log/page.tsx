"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  api,
  AuditLogEntry,
  ProjectCard,
  User,
  BUILDING_LABELS,
  CATEGORY_LABELS,
  CRM_CONTRACT_STATUS_LABELS,
  CRM_CUSTOMER_STATUS_LABELS,
  CRM_QUOTE_STATUS_LABELS,
  CRM_TASK_PRIORITY_LABELS,
  CRM_TASK_STATUS_LABELS,
  CUSTOMER_INVOICE_STATUS_LABELS,
  DOCUMENTATION_SUBTYPE_LABELS,
  DOCUMENT_FAMILY_LABELS,
  GENERATED_DOCUMENT_STATUS_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  SUBCONTRACTOR_CONTRACT_STATUS_LABELS,
  SUBCONTRACTOR_INVOICE_STATUS_LABELS,
  TIG_STATUS_LABELS,
} from "@/lib/api";
import { ACTIVITY_STATUS_LABELS } from "@/lib/project-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

// --- Hungarian label mapping for the raw backend codes stored on the audit
// log (entity_type / field_name / enum-style old_value/new_value). The log
// is a thin mirror of internal model/field names, so without this layer the
// UI leaks things like "project_spec_item", "subcontractors" or
// "ActivityStatus.PENDING" verbatim. Any code without a mapping below still
// renders (as the raw string) — we never hide data, only translate it when
// we can.

const ENTITY_TYPE_LABELS: Record<string, string> = {
  project: "Projekt",
  activity: "Tevékenység",
  activity_dependency: "Tevékenység-függőség",
  project_spec_item: "Műszaki adatlap tétel",
  trade_item: "Munkanem",
  customer: "Ügyfél",
  contract: "Szerződés",
  quote: "Ajánlat",
  communication_event: "Kommunikáció",
  document_template: "Dokumentumsablon",
  generated_document: "Generált dokumentum",
  partner: "Alvállalkozó",
  own_company: "Saját cég",
  tig: "Teljesítésigazolás",
  subcontractor_invoice: "Alvállalkozói számla",
  crm_task: "CRM feladat",
};

const FIELD_NAME_LABELS: Record<string, string> = {
  // generic action-style field_name values (constant, not a real field)
  created: "Létrehozva",
  deleted: "Törölve",
  edit: "Módosítva",
  imported: "Importálva",
  added: "Hozzáadva",
  removed: "Eltávolítva",
  status: "Státusz",
  version: "Verzió",
  sort_order: "Sorrend",
  TEMPLATE_UPDATE: "Sablon módosítva",
  DOC_GENERATE: "Dokumentum generálva",
  DOC_DELETE: "Dokumentum törölve",
  // model attribute names that can appear as field_name on a diff row
  name: "Név",
  settlement: "Település",
  address: "Cím",
  lot_number: "Helyrajzi szám",
  client_name: "Megrendelő neve",
  client_phone: "Megrendelő telefonszáma",
  client_email: "Megrendelő e-mail címe",
  client_phone_2: "Megrendelő telefonszáma (2)",
  client_email_2: "Megrendelő e-mail címe (2)",
  building_type: "Épület típusa",
  floor_area_sqm: "Alapterület (m²)",
  delivery_date: "Átadás dátuma",
  project_manager_id: "Projektmenedzser",
  site_manager_id: "Építésvezető",
  procurement_id: "Beszerzés",
  billing_id: "Számlázás",
  subcontractors: "Alvállalkozók",
  latitude: "Szélességi fok",
  longitude: "Hosszúsági fok",
  status_text: "Státusz megjegyzés",
  waiting_deadline: "Várakozás határideje",
  planning_deadline: "Tervezés határideje",
  foundation_deadline: "Alapozás határideje",
  structure_deadline: "Szerkezetállítás határideje",
  exterior_done_deadline: "Kívülről kész határidő",
  turnkey_deadline: "Kulcsrakész határidő",
  customer_id: "Ügyfél",
  duration_days: "Időtartam (nap)",
  prep_days: "Előkészítés (nap)",
  responsible_role: "Felelős szerepkör",
  assignee_id: "Felelős",
  start_date: "Kezdés dátuma",
  end_date: "Befejezés dátuma",
  is_active: "Aktív",
  category: "Kategória",
  documentation_subtype: "Dokumentáció altípusa",
  notes: "Megjegyzés",
  reminder_date: "Emlékeztető dátuma",
  due_date: "Határidő",
  owner_id: "Felelős",
  priority: "Prioritás",
  phone: "Telefonszám",
  email: "E-mail cím",
  tax_number: "Adószám",
  billing_address: "Számlázási cím",
  mailing_address: "Levelezési cím",
  company_registry_number: "Cégjegyzékszám",
  bank_account_number: "Bankszámlaszám",
  representative_name: "Képviselő neve",
  representative_title: "Képviselő beosztása",
  contact_name: "Kapcsolattartó",
  contact_email: "Kapcsolattartó e-mail címe",
  contact_phone: "Kapcsolattartó telefonszáma",
  registered_address: "Székhely",
  type: "Típus",
  relationship_type: "Kapcsolat típusa",
  source: "Forrás",
  partner_id: "Alvállalkozó",
  subcontractor_contract_id: "Alvállalkozói szerződés",
  date: "Dátum",
  period_start: "Időszak kezdete",
  period_end: "Időszak vége",
  net_value: "Nettó érték",
  vat_type: "ÁFA típusa",
  note: "Megjegyzés",
  own_company_id: "Saját cég",
  contract_type: "Szerződés típusa",
  value: "Érték",
};

// Union of every enum-value → Hungarian label map already used across the
// app, so old_value/new_value render consistently with how the same value
// is labeled elsewhere (e.g. project kanban, CRM pages).
const VALUE_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  ...BUILDING_LABELS,
  ...ROLE_LABELS,
  ...CATEGORY_LABELS,
  ...ACTIVITY_STATUS_LABELS,
  ...CRM_CUSTOMER_STATUS_LABELS,
  ...CRM_QUOTE_STATUS_LABELS,
  ...CRM_CONTRACT_STATUS_LABELS,
  ...CRM_TASK_STATUS_LABELS,
  ...CRM_TASK_PRIORITY_LABELS,
  ...TIG_STATUS_LABELS,
  ...SUBCONTRACTOR_INVOICE_STATUS_LABELS,
  ...CUSTOMER_INVOICE_STATUS_LABELS,
  ...SUBCONTRACTOR_CONTRACT_STATUS_LABELS,
  ...DOCUMENT_FAMILY_LABELS,
  ...DOCUMENTATION_SUBTYPE_LABELS,
  ...GENERATED_DOCUMENT_STATUS_LABELS,
};

function translateFieldName(fieldName: string): string {
  return FIELD_NAME_LABELS[fieldName] || fieldName;
}

function translateEntityType(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] || entityType;
}

// A handful of backend writers store a raw Python enum repr (e.g.
// "ActivityStatus.PENDING") instead of its plain value — strip the
// "ClassName." prefix before looking up the Hungarian label, but still fall
// back to the (stripped, readable) raw text if nothing matches.
function translateSingleValue(raw: string): string {
  const enumReprMatch = raw.match(/^[A-Za-z]+\.([A-Za-z0-9_]+)$/);
  const candidate = (enumReprMatch ? enumReprMatch[1] : raw).toLowerCase();
  if (VALUE_LABELS[candidate]) return VALUE_LABELS[candidate];
  return enumReprMatch ? enumReprMatch[1] : raw;
}

// "edit"-type rows store a comma-separated list of changed field keys as
// their value (e.g. "name,subcontractors") instead of the field's content —
// translate each key too, rather than leaving the raw list verbatim.
function translateAuditValue(fieldName: string, raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (fieldName === "edit" && raw.includes(",")) {
    return raw
      .split(",")
      .map((key) => translateFieldName(key.trim()))
      .join(", ");
  }
  return translateSingleValue(raw);
}

export default function AuditLogPage() {
  const [me, setMe] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [projectId, setProjectId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    api.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  function loadLogs() {
    setLoading(true);
    setLoadError(false);
    api
      .auditLogs(projectId !== "all" ? Number(projectId) : undefined)
      .then(setLogs)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (me && me.role !== "admin" && me.role !== "management") {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Nincs jogosultságod ehhez a felülethez.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-heading font-bold">Audit napló</h1>
          <p className="text-xs text-muted-foreground">Módosítások nyomon követése</p>
        </div>
        <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
          <SelectTrigger className="w-56">
            <SelectValue>
              {(v: string) => {
                if (v === "all") return "Összes projekt";
                const p = projects.find((proj) => String(proj.id) === v);
                return p ? p.name : v;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes projekt</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="relative py-0">
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-card to-transparent sm:hidden" />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Időpont</TableHead>
              <TableHead>Felhasználó</TableHead>
              <TableHead>Projekt</TableHead>
              <TableHead>Entitás</TableHead>
              <TableHead>Mező</TableHead>
              <TableHead>Régi érték</TableHead>
              <TableHead>Új érték</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> Betöltés...
                  </span>
                </TableCell>
              </TableRow>
            )}
            {!loading && loadError && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <span>Nem sikerült betölteni a naplóbejegyzéseket</span>
                    <Button variant="outline" size="sm" onClick={loadLogs}>
                      Újrapróbálkozás
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              !loadError &&
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("hu-HU")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{log.user_name || `#${log.user_id}`}</TableCell>
                  <TableCell className="whitespace-nowrap">{log.project_name || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {translateEntityType(log.entity_type)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {translateFieldName(log.field_name)}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal break-words text-muted-foreground">
                    {translateAuditValue(log.field_name, log.old_value)}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal break-words">
                    {translateAuditValue(log.field_name, log.new_value)}
                  </TableCell>
                </TableRow>
              ))}
            {!loading && !loadError && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nincs naplóbejegyzés
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
