"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
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
import { cn } from "@/lib/utils";

function makeForm() {
  return {
    name: "", project_code: "", settlement: "", address: "", lot_number: "",
    client_name: "", client_phone: "", client_email: "", client_phone_2: "", client_email_2: "",
    floor_area_sqm: 145, building_type: "light_steel",
    delivery_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    with_schedule: true,
  };
}

type Form = ReturnType<typeof makeForm>;

const STEPS = ["Alapadatok", "Ügyfél", "Épület", "Átadás"] as const;

function stepIsValid(step: number, form: Form): boolean {
  if (step === 0) return !!(form.name && form.settlement && form.address);
  if (step === 1) return !!form.client_name;
  if (step === 2) return !!(form.building_type && form.floor_area_sqm > 0);
  if (step === 3) return !!form.delivery_date;
  return true;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: number) => void;
};

export function NewProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(makeForm);
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) { setForm(makeForm()); setStep(0); }
    onOpenChange(next);
  }

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      if (stepIsValid(step, form)) setStep((s) => s + 1);
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { ...form, floor_area_sqm: Number(form.floor_area_sqm) };
      if (!payload.lot_number)   payload.lot_number   = null;
      if (!payload.client_phone) payload.client_phone = null;
      if (!payload.client_email) payload.client_email = null;
      if (!payload.client_phone_2) payload.client_phone_2 = null;
      if (!payload.client_email_2) payload.client_email_2 = null;
      if (!payload.project_code) payload.project_code = null;
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

  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Új projekt</DialogTitle>
            <DialogDescription>Töltsd ki az adatokat az ütemterv automatikus generálásához.</DialogDescription>
          </DialogHeader>

          <ol className="my-4 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    i < step ? "bg-primary text-primary-foreground" :
                    i === step ? "border-2 border-primary text-primary" :
                    "border border-border text-muted-foreground"
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span className={cn("hidden text-xs font-medium sm:inline", i === step ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-border")} />}
              </li>
            ))}
          </ol>

          <div className="grid min-h-[220px] gap-3 py-2 sm:grid-cols-2">
            {step === 0 && (
              <>
                {([
                  ["name",         "Projekt neve",      true],
                  ["settlement",   "Település",         true],
                  ["address",      "Cím",               true],
                  ["lot_number",   "Helyrajzi szám",    false],
                ] as const).map(([key, label, required]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      required={required}
                      value={form[key] as string}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label htmlFor="project_code">Projekt azonosító</Label>
                  <Input
                    id="project_code"
                    placeholder="Automatikus, ha üresen hagyod (pl. LTF-001)"
                    value={form.project_code}
                    onChange={(e) => update("project_code", e.target.value)}
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                {([
                  ["client_name",  "Ügyfél neve",   true],
                  ["client_phone", "Ügyfél telefon", false],
                  ["client_email", "Ügyfél e-mail",  false],
                  ["client_phone_2", "Ügyfél telefon 2", false],
                  ["client_email_2", "Ügyfél e-mail 2",  false],
                ] as const).map(([key, label, required]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      required={required}
                      value={form[key] as string}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </div>
                ))}
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="floor_area_sqm">Alapterület (m²)</Label>
                  <Input
                    id="floor_area_sqm"
                    type="number"
                    required
                    min={1}
                    value={form.floor_area_sqm}
                    onChange={(e) => update("floor_area_sqm", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Épülettípus</Label>
                  <Select value={form.building_type} onValueChange={(v) => update("building_type", v ?? "light_steel")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => BUILDING_OPTIONS.find(([val]) => val === v)?.[1] ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BUILDING_OPTIONS.map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery_date">Átadási határidő</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    required
                    value={form.delivery_date}
                    onChange={(e) => update("delivery_date", e.target.value)}
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <Label>Ütemterv</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => update("with_schedule", true)}
                      className={cn(
                        "rounded-md border p-3 text-left text-sm transition-colors",
                        form.with_schedule ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                      )}
                    >
                      <p className="font-medium">Ütemezett feladatokkal</p>
                      <p className="text-xs text-muted-foreground">
                        A rendszer automatikusan létrehozza az ütemterv sablonban bejelölt feladatokat.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => update("with_schedule", false)}
                      className={cn(
                        "rounded-md border p-3 text-left text-sm transition-colors",
                        !form.with_schedule ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                      )}
                    >
                      <p className="font-medium">Feladatlista nélkül</p>
                      <p className="text-xs text-muted-foreground">
                        A projekt üres ütemtervvel jön létre, a feladatokat utólag lehet felvenni.
                      </p>
                    </button>
                  </div>
                </div>
                <div className="col-span-full space-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{form.name || "—"} ({form.project_code || "automatikus"})</p>
                  <p className="text-muted-foreground">{form.settlement}, {form.address}</p>
                  <p className="text-muted-foreground">Ügyfél: {form.client_name || "—"}</p>
                  <p className="text-muted-foreground">
                    {BUILDING_OPTIONS.find(([v]) => v === form.building_type)?.[1]} · {form.floor_area_sqm} m²
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || creating}
            >
              Vissza
            </Button>
            <Button type="submit" disabled={creating || !stepIsValid(step, form)}>
              {creating ? "Mentés..." : isLastStep ? "Létrehozás" : "Tovább"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
