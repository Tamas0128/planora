"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppLayout from "@/components/AppLayout";
import {
  api,
  CustomerInvoice,
  CUSTOMER_INVOICE_STATUS_COLORS,
  CUSTOMER_INVOICE_STATUS_LABELS,
  Partner,
  ProjectCard,
  ProjectFinanceOverviewRow,
  SubcontractorInvoice,
  SUBCONTRACTOR_INVOICE_STATUS_COLORS,
  SUBCONTRACTOR_INVOICE_STATUS_LABELS,
  Tig,
  TIG_STATUS_COLORS,
  TIG_STATUS_LABELS,
  UserBrief,
} from "@/lib/api";
import { FINANCE_STATUS_CFG } from "@/lib/project-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

function formatHuf(value?: string | number | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toLocaleString("hu-HU")} Ft` : String(value);
}

function FinanceStatusBadge({ status }: { status: string }) {
  const cfg = FINANCE_STATUS_CFG[status] ?? FINANCE_STATUS_CFG.green;
  return <Badge className={cfg.badge}>{cfg.label}</Badge>;
}

const ANY = "__any__";

function OverviewTab({ projects, users }: { projects: ProjectCard[]; users: UserBrief[] }) {
  const [rows, setRows] = useState<ProjectFinanceOverviewRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(ANY);
  const [managerId, setManagerId] = useState(ANY);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const params: Record<string, string> = {};
    if (projectId !== ANY) params.project_id = projectId;
    if (managerId !== ANY) params.project_manager_id = managerId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    setLoading(true);
    api.financeOverview(params).then(setRows).catch(() => setRows(null)).finally(() => setLoading(false));
  }, [projectId, managerId, dateFrom, dateTo]);

  const managers = users.filter((u) => u.role === "project_manager");

  return (
    <div className={loading ? "opacity-60" : ""}>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Projekt</Label>
          <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
            <SelectTrigger className="w-48"><SelectValue>{(v: string) => (v === ANY ? "Összes" : projects.find((p) => String(p.id) === v)?.name ?? v)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Összes</SelectItem>
              {projects.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Projektvezető</Label>
          <Select value={managerId} onValueChange={(v) => setManagerId(v as string)}>
            <SelectTrigger className="w-48"><SelectValue>{(v: string) => (v === ANY ? "Összes" : managers.find((m) => String(m.id) === v)?.full_name ?? v)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Összes</SelectItem>
              {managers.map((m) => (<SelectItem key={m.id} value={String(m.id)}>{m.full_name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Időszak (határidőtől)</Label>
          <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Időszak (határidőig)</Label>
          <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {rows && rows.length > 0 && (
        <Card className="mb-3">
          <CardHeader>
            <CardTitle>Cash flow projektenként</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.map((r) => ({ name: r.project_name, value: Number(r.cash_flow_balance) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`} />
                <Tooltip formatter={(v) => formatHuf(v as number)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {rows.map((r, i) => (
                    <Cell key={i} fill={Number(r.cash_flow_balance) < 0 ? "var(--color-critical)" : "var(--chart-1)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Szerződés érték</TableHead>
              <TableHead>Bevételek</TableHead>
              <TableHead>Kiadások</TableHead>
              <TableHead>Cash flow</TableHead>
              <TableHead>Lejárt követelés</TableHead>
              <TableHead>Lejárt kötelezettség</TableHead>
              <TableHead>Pénzügyi státusz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => (
              <TableRow key={r.project_id}>
                <TableCell className="font-medium">
                  <Link href={`/projects/${r.project_id}`} className="hover:underline">
                    {r.project_name} <span className="text-muted-foreground">({r.project_code})</span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.customer_name ?? "—"}</TableCell>
                <TableCell>{formatHuf(r.contract_gross)}</TableCell>
                <TableCell>{formatHuf(r.received_gross)} <span className="text-muted-foreground">/ {formatHuf(r.invoiced_gross)}</span></TableCell>
                <TableCell>{formatHuf(r.subcontractor_paid_gross)} <span className="text-muted-foreground">/ {formatHuf(r.subcontractor_invoiced_gross)}</span></TableCell>
                <TableCell className={cn(Number(r.cash_flow_balance) < 0 && "text-destructive")}>
                  {formatHuf(r.cash_flow_balance)}
                </TableCell>
                <TableCell className={cn(Number(r.overdue_receivable) > 0 && "text-destructive")}>
                  {formatHuf(r.overdue_receivable)}
                </TableCell>
                <TableCell className={cn(Number(r.overdue_payable) > 0 && "text-destructive")}>
                  {formatHuf(r.overdue_payable)}
                </TableCell>
                <TableCell><FinanceStatusBadge status={r.finance_status} /></TableCell>
              </TableRow>
            ))}
            {rows && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nincs megjeleníthető projekt</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function TigsTab({ projects, partners }: { projects: ProjectCard[]; partners: Partner[] }) {
  const [tigs, setTigs] = useState<Tig[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(ANY);
  const [partnerId, setPartnerId] = useState(ANY);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (projectId !== ANY) params.project_id = projectId;
    if (partnerId !== ANY) params.partner_id = partnerId;
    setLoading(true);
    api.financeAllTigs(params).then(setTigs).catch(() => setTigs(null)).finally(() => setLoading(false));
  }, [projectId, partnerId]);

  return (
    <div className={loading ? "opacity-60" : ""}>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Projekt</Label>
          <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
            <SelectTrigger className="w-48"><SelectValue>{(v: string) => (v === ANY ? "Összes" : projects.find((p) => String(p.id) === v)?.name ?? v)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Összes</SelectItem>
              {projects.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Partner</Label>
          <Select value={partnerId} onValueChange={(v) => setPartnerId(v as string)}>
            <SelectTrigger className="w-48"><SelectValue>{(v: string) => (v === ANY ? "Összes" : partners.find((p) => String(p.id) === v)?.name ?? v)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Összes</SelectItem>
              {partners.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Időszak</TableHead>
              <TableHead>Nettó / Bruttó</TableHead>
              <TableHead>Felhasznált</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tigs ?? []).map((t) => {
              const partner = partners.find((p) => p.id === t.partner_id);
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${t.project_id}`} className="hover:underline">{t.project_name}</Link>
                  </TableCell>
                  <TableCell>{partner?.name ?? `#${t.partner_id}`}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(t.period_start).toLocaleDateString("hu-HU")} – {new Date(t.period_end).toLocaleDateString("hu-HU")}
                  </TableCell>
                  <TableCell>{formatHuf(t.net_value)} / {formatHuf(t.gross_value)}</TableCell>
                  <TableCell className={cn(t.invoice_count === 0 && "text-warning-foreground")}>
                    {t.invoice_count === 0 ? "Nincs számla" : `${formatHuf(t.consumed_amount)} (${t.invoice_count} db)`}
                  </TableCell>
                  <TableCell><Badge className={TIG_STATUS_COLORS[t.status] ?? ""}>{TIG_STATUS_LABELS[t.status] ?? t.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {tigs && tigs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nincs TIG</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function SubcontractorInvoicesTable({ projects, partners }: { projects: ProjectCard[]; partners: Partner[] }) {
  const [invoices, setInvoices] = useState<SubcontractorInvoice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(ANY);
  const [partnerId, setPartnerId] = useState(ANY);
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (projectId !== ANY) params.project_id = projectId;
    if (partnerId !== ANY) params.partner_id = partnerId;
    if (overdueOnly) params.overdue_only = "true";
    setLoading(true);
    api.financeAllSubcontractorInvoices(params).then(setInvoices).catch(() => setInvoices(null)).finally(() => setLoading(false));
  }, [projectId, partnerId, overdueOnly]);

  return (
    <div className={loading ? "opacity-60" : ""}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Projekt</Label>
          <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
            <SelectTrigger className="w-48"><SelectValue>{(v: string) => (v === ANY ? "Összes" : projects.find((p) => String(p.id) === v)?.name ?? v)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Összes</SelectItem>
              {projects.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Partner</Label>
          <Select value={partnerId} onValueChange={(v) => setPartnerId(v as string)}>
            <SelectTrigger className="w-48"><SelectValue>{(v: string) => (v === ANY ? "Összes" : partners.find((p) => String(p.id) === v)?.name ?? v)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Összes</SelectItem>
              {partners.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm">
          <Checkbox checked={overdueOnly} onCheckedChange={(v) => setOverdueOnly(!!v)} />
          Csak lejárt
        </label>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Számlaszám</TableHead>
              <TableHead>Fizetési határidő</TableHead>
              <TableHead>Nettó / Bruttó</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invoices ?? []).map((inv) => {
              const partner = partners.find((p) => p.id === inv.partner_id);
              const overdue = inv.due_date < new Date().toISOString().slice(0, 10) && !inv.payment_date;
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${inv.project_id}`} className="hover:underline">{inv.project_name}</Link>
                  </TableCell>
                  <TableCell>{partner?.name ?? `#${inv.partner_id}`}</TableCell>
                  <TableCell>{inv.invoice_number}{!inv.tig_id && <span className="ml-1 text-[10px] text-warning-foreground">nincs TIG</span>}</TableCell>
                  <TableCell className={cn(overdue && "text-destructive")}>{new Date(inv.due_date).toLocaleDateString("hu-HU")}</TableCell>
                  <TableCell>{formatHuf(inv.net_value)} / {formatHuf(inv.gross_value)}</TableCell>
                  <TableCell><Badge className={SUBCONTRACTOR_INVOICE_STATUS_COLORS[inv.status] ?? ""}>{SUBCONTRACTOR_INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {invoices && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nincs alvállalkozói számla</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CustomerInvoicesTable({ projects }: { projects: ProjectCard[] }) {
  const [invoices, setInvoices] = useState<CustomerInvoice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(ANY);
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (projectId !== ANY) params.project_id = projectId;
    if (overdueOnly) params.overdue_only = "true";
    setLoading(true);
    api.financeAllCustomerInvoices(params).then(setInvoices).catch(() => setInvoices(null)).finally(() => setLoading(false));
  }, [projectId, overdueOnly]);

  return (
    <div className={loading ? "opacity-60" : ""}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Projekt</Label>
          <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
            <SelectTrigger className="w-48"><SelectValue>{(v: string) => (v === ANY ? "Összes" : projects.find((p) => String(p.id) === v)?.name ?? v)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Összes</SelectItem>
              {projects.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm">
          <Checkbox checked={overdueOnly} onCheckedChange={(v) => setOverdueOnly(!!v)} />
          Csak lejárt
        </label>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projekt</TableHead>
              <TableHead>Megrendelő</TableHead>
              <TableHead>Számlaszám</TableHead>
              <TableHead>Fizetési határidő</TableHead>
              <TableHead>Nettó / Bruttó</TableHead>
              <TableHead>Állapot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invoices ?? []).map((inv) => {
              const overdue = inv.due_date < new Date().toISOString().slice(0, 10) && !inv.payment_received_date;
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${inv.project_id}`} className="hover:underline">{inv.project_name}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{inv.customer_name ?? "Nincs megrendelő"}</TableCell>
                  <TableCell>{inv.invoice_number}</TableCell>
                  <TableCell className={cn(overdue && "text-destructive")}>{new Date(inv.due_date).toLocaleDateString("hu-HU")}</TableCell>
                  <TableCell>{formatHuf(inv.net_value)} / {formatHuf(inv.gross_value)}</TableCell>
                  <TableCell><Badge className={CUSTOMER_INVOICE_STATUS_COLORS[inv.status] ?? ""}>{CUSTOMER_INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {invoices && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nincs ügyfél számla</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function InvoicesTab({ projects, partners }: { projects: ProjectCard[]; partners: Partner[] }) {
  const [kind, setKind] = useState<"subcontractor" | "customer">("subcontractor");
  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => setKind("subcontractor")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium",
            kind === "subcontractor" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          Alvállalkozói számlák
        </button>
        <button
          type="button"
          onClick={() => setKind("customer")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium",
            kind === "customer" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          Ügyfél számlák
        </button>
      </div>
      {kind === "subcontractor" ? (
        <SubcontractorInvoicesTable projects={projects} partners={partners} />
      ) : (
        <CustomerInvoicesTable projects={projects} />
      )}
    </div>
  );
}

export default function FinancePage() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    api.projects().then(setProjects).catch(() => setProjects([]));
    api.usersDirectory().then(setUsers).catch(() => setUsers([]));
    api.financePartners().then(setPartners).catch(() => setPartners([]));
  }, []);

  return (
    <AppLayout>
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pénzügy</p>
        <h1 className="text-2xl font-heading font-semibold text-foreground">Pénzügyi áttekintő</h1>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Áttekintő</TabsTrigger>
          <TabsTrigger value="tigs">TIG-ek</TabsTrigger>
          <TabsTrigger value="invoices">Számlák</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab projects={projects} users={users} />
        </TabsContent>
        <TabsContent value="tigs" className="mt-4">
          <TigsTab projects={projects} partners={partners} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab projects={projects} partners={partners} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
