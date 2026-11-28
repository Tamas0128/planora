"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { api, getCachedUser, Partner, User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trimmedPayload } from "@/lib/utils";

const emptyForm = {
  name: "",
  tax_number: "",
  billing_address: "",
  mailing_address: "",
  company_registry_number: "",
  bank_account_number: "",
  representative_name: "",
  representative_title: "",
  contact_name: "",
  phone: "",
  email: "",
};

type PartnerForm = typeof emptyForm;

function toForm(p: Partner): PartnerForm {
  return {
    name: p.name,
    tax_number: p.tax_number ?? "",
    billing_address: p.billing_address ?? "",
    mailing_address: p.mailing_address ?? "",
    company_registry_number: p.company_registry_number ?? "",
    bank_account_number: p.bank_account_number ?? "",
    representative_name: p.representative_name ?? "",
    representative_title: p.representative_title ?? "",
    contact_name: p.contact_name ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
  };
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [me, setMe] = useState<User | null>(() => getCachedUser());
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .financePartners()
      .then((data) => setPartners(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "billing";

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  }

  function openEdit(partner: Partner) {
    setEditingId(partner.id);
    setForm(toForm(partner));
    setShowDialog(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = trimmedPayload(form);
      if (editingId) {
        const updated = await api.updateFinancePartner(editingId, payload);
        setPartners((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await api.createFinancePartner(payload);
        setPartners((prev) => [...prev, created]);
      }
      setShowDialog(false);
      toast.success(editingId ? "Alvállalkozó mentve" : "Alvállalkozó létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-heading font-bold text-foreground">Alvállalkozói törzs</h1>
          <p className="text-xs text-muted-foreground">
            Alvállalkozók cégadatai — TIG, alvállalkozói szerződés és a hozzájuk tartozó dokumentumgenerálás forrása.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" /> Új alvállalkozó
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
              <TableHead>Kapcsolattartó</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>
                <span className="sr-only">Műveletek</span>
              </TableHead>
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
                    <span>Nem sikerült betölteni a listát</span>
                    <Button variant="outline" size="sm" onClick={load}>
                      Újrapróbálkozás
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              !loadError &&
              partners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-medium">{p.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.tax_number || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.billing_address || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.contact_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.phone || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.email || "—"}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => openEdit(p)}
                        aria-label={`Szerkesztés: ${p.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            {!loading && !loadError && partners.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nincs felvitt alvállalkozó
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
              <DialogTitle>{editingId ? "Alvállalkozó szerkesztése" : "Új alvállalkozó"}</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2 pr-1">
              <div>
                <h3 className="text-xs font-semibold text-foreground">Cégadatok</h3>
                <p className="text-[11px] text-muted-foreground">A cég azonosítására és számlázására vonatkozó adatok.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Cégnév</Label>
                <Input id="p-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-tax">Adószám</Label>
                  <Input id="p-tax" value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-registry">Cégjegyzékszám</Label>
                  <Input id="p-registry" value={form.company_registry_number} onChange={(e) => setForm({ ...form, company_registry_number: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-billing">Székhely</Label>
                <Input id="p-billing" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-mailing">Levelezési cím</Label>
                <Input id="p-mailing" value={form.mailing_address} onChange={(e) => setForm({ ...form, mailing_address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-bank">Bankszámlaszám</Label>
                <Input id="p-bank" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
              </div>

              <div className="pt-1">
                <h3 className="text-xs font-semibold text-foreground">Képviselő</h3>
                <p className="text-[11px] text-muted-foreground">A céget szerződésben képviselő személy.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="p-rep-name">Képviselő neve</Label>
                  <Input id="p-rep-name" value={form.representative_name} onChange={(e) => setForm({ ...form, representative_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-rep-title">Képviselő beosztása</Label>
                  <Input id="p-rep-title" value={form.representative_title} onChange={(e) => setForm({ ...form, representative_title: e.target.value })} />
                </div>
              </div>

              <div className="pt-1">
                <h3 className="text-xs font-semibold text-foreground">Kapcsolattartó</h3>
                <p className="text-[11px] text-muted-foreground">Napi kapcsolattartásra szolgáló elérhetőség.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-contact-name">Kapcsolattartó neve</Label>
                  <Input id="p-contact-name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">Kapcsolattartó telefon</Label>
                  <Input id="p-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-email">Kapcsolattartó e-mail</Label>
                  <Input id="p-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
