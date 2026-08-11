"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { api, getCachedUser, OwnCompany, User } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trimmedPayload } from "@/lib/utils";

const emptyForm = {
  name: "",
  registered_address: "",
  mailing_address: "",
  tax_number: "",
  company_registry_number: "",
  bank_account_number: "",
  representative_name: "",
  representative_title: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
};

type OwnCompanyForm = typeof emptyForm;

function toForm(c: OwnCompany): OwnCompanyForm {
  return {
    name: c.name,
    registered_address: c.registered_address ?? "",
    mailing_address: c.mailing_address ?? "",
    tax_number: c.tax_number ?? "",
    company_registry_number: c.company_registry_number ?? "",
    bank_account_number: c.bank_account_number ?? "",
    representative_name: c.representative_name ?? "",
    representative_title: c.representative_title ?? "",
    contact_name: c.contact_name ?? "",
    contact_email: c.contact_email ?? "",
    contact_phone: c.contact_phone ?? "",
  };
}

export default function OwnCompaniesPage() {
  const [companies, setCompanies] = useState<OwnCompany[]>([]);
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OwnCompanyForm>(emptyForm);

  function load() {
    api.listOwnCompanies().then(setCompanies).catch(() => setCompanies([]));
  }

  useEffect(() => {
    load();
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const isAdmin = me?.role === "admin";

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(company: OwnCompany) {
    setEditingId(company.id);
    setForm(toForm(company));
    setShowDialog(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = trimmedPayload(form);
      if (editingId) {
        const updated = await api.updateOwnCompany(editingId, payload);
        setCompanies((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await api.createOwnCompany(payload);
        setCompanies((prev) => [...prev, created]);
      }
      setShowDialog(false);
      toast.success(editingId ? "Cég mentve" : "Cég létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(company: OwnCompany) {
    try {
      const updated = await api.updateOwnCompany(company.id, { is_active: !company.is_active });
      setCompanies((prev) => prev.map((c) => (c.id === company.id ? updated : c)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Cégadatok</h1>
          <p className="text-xs text-muted-foreground">
            Saját cégeitek adatai — a szerződés-generálásnál a "Megrendelő (fővállalkozó)" / "Vállalkozó" fél
            forrása. Több cég is felvehető, ha több jogi entitáson keresztül dolgoztok.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" /> Új cég
          </Button>
        )}
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cégnév</TableHead>
              <TableHead>Adószám</TableHead>
              <TableHead>Székhely</TableHead>
              <TableHead>Képviselő</TableHead>
              <TableHead>Aktív</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs font-medium">{c.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.tax_number || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.registered_address || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.representative_name || "—"}</TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Checkbox checked={c.is_active} aria-label="Aktív" onCheckedChange={() => toggleActive(c)} />
                  ) : (
                    <Badge variant={c.is_active ? "default" : "outline"} className="text-xs">
                      {c.is_active ? "Aktív" : "Inaktív"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nincs felvitt saját cég
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Cég szerkesztése" : "Új saját cég"}</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2 pr-1">
              <div className="space-y-1.5">
                <Label htmlFor="oc-name">Cégnév</Label>
                <Input id="oc-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oc-tax">Adószám</Label>
                  <Input id="oc-tax" value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oc-registry">Cégjegyzékszám</Label>
                  <Input id="oc-registry" value={form.company_registry_number} onChange={(e) => setForm({ ...form, company_registry_number: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oc-address">Székhely</Label>
                <Input id="oc-address" value={form.registered_address} onChange={(e) => setForm({ ...form, registered_address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oc-mailing">Levelezési cím</Label>
                <Input id="oc-mailing" value={form.mailing_address} onChange={(e) => setForm({ ...form, mailing_address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oc-bank">Bankszámlaszám</Label>
                <Input id="oc-bank" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oc-rep-name">Képviselő neve</Label>
                  <Input id="oc-rep-name" value={form.representative_name} onChange={(e) => setForm({ ...form, representative_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oc-rep-title">Képviselő beosztása</Label>
                  <Input id="oc-rep-title" value={form.representative_title} onChange={(e) => setForm({ ...form, representative_title: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="oc-contact-name">Kapcsolattartó neve</Label>
                  <Input id="oc-contact-name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oc-contact-phone">Kapcsolattartó telefon</Label>
                  <Input id="oc-contact-phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oc-contact-email">Kapcsolattartó e-mail</Label>
                  <Input id="oc-contact-email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || !form.name}>
                {saving ? "Mentés..." : "Mentés"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
