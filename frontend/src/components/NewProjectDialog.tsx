"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { BUILDING_OPTIONS } from "@/lib/project-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function makeForm() {
  return {
    name: "", project_code: "", settlement: "", address: "",
    lot_number: "", client_name: "", client_phone: "", client_email: "",
    floor_area_sqm: 145,
    delivery_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    building_type: "light_steel",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: number) => void;
};

export function NewProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(makeForm);
  const [creating, setCreating] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) setForm(makeForm());
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { ...form, floor_area_sqm: Number(form.floor_area_sqm) };
      if (!payload.lot_number)   payload.lot_number   = null;
      if (!payload.client_phone) payload.client_phone = null;
      if (!payload.client_email) payload.client_email = null;
      const created = await api.createProject(payload);
      handleOpenChange(false);
      toast.success("Projekt létrehozva");
      if (onCreated) {
        onCreated(created.id);
      } else {
        router.push(`/projects/${created.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Új projekt</DialogTitle>
            <DialogDescription>Töltsd ki az adatokat az ütemterv automatikus generálásához.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            {([
              ["name",         "Projekt neve",      true],
              ["project_code", "Projekt azonosító", true],
              ["settlement",   "Település",         true],
              ["address",      "Cím",               true],
              ["lot_number",   "Helyrajzi szám",    false],
              ["client_name",  "Ügyfél neve",       true],
              ["client_phone", "Ügyfél telefon",    false],
              ["client_email", "Ügyfél e-mail",     false],
            ] as const).map(([key, label, required]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  required={required}
                  value={form[key] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="floor_area_sqm">Alapterület (m²)</Label>
              <Input
                id="floor_area_sqm"
                type="number"
                required
                min={1}
                value={form.floor_area_sqm}
                onChange={(e) => setForm({ ...form, floor_area_sqm: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delivery_date">Átadási határidő</Label>
              <Input
                id="delivery_date"
                type="date"
                required
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Épülettípus</Label>
              <Select value={form.building_type} onValueChange={(v) => setForm({ ...form, building_type: v ?? "light_steel" })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUILDING_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={creating} className="bg-green-700 hover:bg-green-800">
              {creating ? "Mentés..." : "Létrehozás"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
