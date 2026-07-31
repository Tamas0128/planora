"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  api,
  CRM_CUSTOMER_STATUS_COLORS,
  CRM_CUSTOMER_STATUS_LABELS,
  CRM_CUSTOMER_TYPE_LABELS,
  CrmCustomer,
  CrmImportRowResult,
  User,
  UserBrief,
} from "@/lib/api";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_OPTIONS = Object.entries(CRM_CUSTOMER_TYPE_LABELS) as [string, string][];
const STATUS_OPTIONS = Object.entries(CRM_CUSTOMER_STATUS_LABELS) as [string, string][];

const emptyForm = {
  type: "person",
  name: "",
  owner_id: "",
  phone: "",
  email: "",
  tax_number: "",
  billing_address: "",
};

export default function CrmCustomersPage() {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [importResults, setImportResults] = useState<CrmImportRowResult[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function load() {
    const params: Record<string, string> = {};
    if (nameFilter.trim()) params.name = nameFilter.trim();
    if (typeFilter !== "all") params.type = typeFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    api.crmCustomers(params).then(setCustomers).catch(console.error);
  }

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    api.usersDirectory().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameFilter, typeFilter, statusFilter]);

  const isPerson = form.type === "person";

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const body: Record<string, unknown> = { type: form.type, name: form.name };
      if (form.owner_id) body.owner_id = Number(form.owner_id);
      if (!isPerson) {
        if (form.phone) body.phone = form.phone;
        if (form.email) body.email = form.email;
        if (form.tax_number) body.tax_number = form.tax_number;
        if (form.billing_address) body.billing_address = form.billing_address;
      }
      const created = await api.createCrmCustomer(body);
      setShowNew(false);
      setForm(emptyForm);
      load();
      if (created.duplicate_name_warning) {
        toast.warning(`Ügyfél létrehozva (${created.customer_number}) — figyelem, már létezik azonos nevű ügyfél`);
      } else {
        toast.success(`Ügyfél létrehozva (${created.customer_number})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreating(false);
    }
  }

  async function handleExport() {
    try {
      await api.exportCrmCustomers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az exportálás során");
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const res = await api.importCrmCustomers(file);
      setImportResults(res.results);
      const failed = res.results.filter((r) => !r.success).length;
      if (failed === 0) {
        toast.success(`Import kész: ${res.results.length} sor sikeresen importálva`);
      } else {
        toast.warning(`Import kész: ${res.results.length - failed} sikeres, ${failed} hibás sor`);
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba az importálás során");
    }
  }

  const canImport = me?.role === "admin" || me?.role === "management";

  return (
    <AppLayout>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Ügyfelek</h1>
          <p className="text-xs text-muted-foreground">CRM ügyfélnyilvántartás</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download /> Export
          </Button>
          {canImport && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button variant="outline" onClick={() => importInputRef.current?.click()}>
                <Upload /> Import
              </Button>
            </>
          )}
          <Button onClick={() => setShowNew(true)}>
            <Plus /> Új ügyfél
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Keresés név szerint…"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-full sm:w-56"
        />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as string)}>
          <SelectTrigger size="sm" className="w-full sm:w-40">
            <SelectValue>{(v: string) => (v === "all" ? "Minden típus" : CRM_CUSTOMER_TYPE_LABELS[v] ?? v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden típus</SelectItem>
            {TYPE_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
          <SelectTrigger size="sm" className="w-full sm:w-40">
            <SelectValue>{(v: string) => (v === "all" ? "Minden státusz" : CRM_CUSTOMER_STATUS_LABELS[v] ?? v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden státusz</SelectItem>
            {STATUS_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {importResults && (
        <Card className="mb-3 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Import eredménye</span>
            <Button variant="ghost" size="sm" onClick={() => setImportResults(null)}>Bezár</Button>
          </div>
          <div className="max-h-48 overflow-y-auto text-xs">
            {importResults.map((r) => (
              <div key={r.row} className="flex items-center gap-2 border-b border-border py-1 last:border-0">
                <span className="w-10 text-muted-foreground">#{r.row}</span>
                {r.success ? (
                  <Badge className="bg-accent-100 text-accent-700">OK</Badge>
                ) : (
                  <Badge variant="destructive">Hiba</Badge>
                )}
                <span className="truncate">{r.success ? `${r.customer_number} — ${r.name}` : r.error}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <form onSubmit={createCustomer}>
            <DialogHeader>
              <DialogTitle>Új ügyfél</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label>Ügyfél típusa</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as string })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => CRM_CUSTOMER_TYPE_LABELS[v] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-name">Név</Label>
                <Input
                  id="new-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              {me && (me.role === "admin" || me.role === "management") && (
                <div className="space-y-1.5">
                  <Label>Felelős ügyintéző</Label>
                  <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v as string })}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => users.find((u) => String(u.id) === v)?.full_name ?? "Válassz ügyintézőt"}
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
              {isPerson ? (
                <p className="text-xs text-muted-foreground">
                  Magánszemély ügyfélnél a rendszer kizárólag a nevet tárolja — további elérhetőség nem adható meg.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-phone">Telefon</Label>
                    <Input id="new-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-email">E-mail</Label>
                    <Input id="new-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-tax">Adószám</Label>
                    <Input id="new-tax" value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-billing">Számlázási cím</Label>
                    <Input id="new-billing" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Mentés..." : "Létrehozás"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Azonosító</TableHead>
              <TableHead>Név</TableHead>
              <TableHead>Típus</TableHead>
              <TableHead>Státusz</TableHead>
              <TableHead>Létrehozva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/crm/customers/${c.id}`} className="hover:underline">
                    {c.customer_number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/crm/customers/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{CRM_CUSTOMER_TYPE_LABELS[c.type] ?? c.type}</TableCell>
                <TableCell>
                  <Badge className={CRM_CUSTOMER_STATUS_COLORS[c.status] ?? ""}>
                    {CRM_CUSTOMER_STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("hu-HU")}
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nincs ügyfél
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
