"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import {
  api,
  BUILDING_LABELS,
  ProjectCard,
  STATUS_LABELS,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLUMN_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"];

const COLUMN_HEADER: Record<string, string> = {
  planning: "bg-sky-500",
  foundation: "bg-amber-500",
  structure: "bg-orange-500",
  exterior_done: "bg-teal-500",
  turnkey: "bg-emerald-500",
};

const PROGRESS_COLOR: Record<string, string> = {
  planning: "[&>div]:bg-sky-500",
  foundation: "[&>div]:bg-amber-500",
  structure: "[&>div]:bg-orange-500",
  exterior_done: "[&>div]:bg-teal-500",
  turnkey: "[&>div]:bg-emerald-500",
};

const BUILDING_OPTIONS: [string, string][] = [
  ["light_steel", "Könnyűszerkezetes"],
  ["clt", "CLT"],
  ["timber_frame", "Gerendaház"],
  ["other", "Egyéb"],
];

function ProjectCardComponent({ project }: { project: ProjectCard }) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="group cursor-pointer border border-slate-200 p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight text-slate-900">{project.name}</h3>
        </div>
        <p className="mt-1 text-xs font-medium text-slate-500">{project.settlement}</p>
        <div className="mt-3 space-y-0.5 text-xs text-slate-500">
          <p>{project.client_name}</p>
          <p>{BUILDING_LABELS[project.building_type] || project.building_type} · {project.floor_area_sqm} m²</p>
          {project.project_manager_name && <p>PM: {project.project_manager_name}</p>}
          {project.site_manager_name && <p>Épv.: {project.site_manager_name}</p>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
          </span>
          <Badge className="bg-slate-100 text-slate-600 text-[10px]">
            {project.completion_percent}%
          </Badge>
        </div>
        <Progress
          value={project.completion_percent}
          className={`mt-2 h-1.5 ${PROGRESS_COLOR[project.status] || ""}`}
        />
      </Card>
    </Link>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [board, setBoard] = useState<Record<string, ProjectCard[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => ({
    name: "",
    project_code: "",
    settlement: "",
    address: "",
    lot_number: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    floor_area_sqm: 145,
    delivery_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    building_type: "light_steel",
  }));

  function load() {
    api.kanban().then(setBoard).catch(console.error);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      payload.floor_area_sqm = Number(form.floor_area_sqm);
      if (!payload.lot_number) payload.lot_number = null;
      if (!payload.client_phone) payload.client_phone = null;
      if (!payload.client_email) payload.client_email = null;
      const created = await api.createProject(payload);
      setShowNew(false);
      toast.success("Projekt létrehozva");
      router.push(`/projects/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projektek</h1>
          <p className="text-sm text-slate-500">Kanban board — projekt státuszok</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus /> Új projekt
        </Button>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={createProject}>
            <DialogHeader>
              <DialogTitle>Új projekt</DialogTitle>
              <DialogDescription>
                Töltsd ki az adatokat az ütemterv automatikus generálásához.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              {(
                [
                  ["name", "Projekt neve", true],
                  ["project_code", "Projekt azonosító", true],
                  ["settlement", "Település", true],
                  ["address", "Cím", true],
                  ["lot_number", "Helyrajzi szám", false],
                  ["client_name", "Ügyfél neve", true],
                  ["client_phone", "Ügyfél telefon", false],
                  ["client_email", "Ügyfél e-mail", false],
                ] as const
              ).map(([key, label, required]) => (
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
                <Select
                  value={form.building_type}
                  onValueChange={(v) => setForm({ ...form, building_type: v ?? "light_steel" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating}>
                {creating ? "Mentés..." : "Létrehozás"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => (
          <div key={status} className="flex min-w-[272px] flex-1 flex-col">
            {/* MeisterTask-style bold colored pill header */}
            <div
              className={`mb-3 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white ${COLUMN_HEADER[status]}`}
            >
              <span>{STATUS_LABELS[status]}</span>
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
                {(board[status] || []).length}
              </span>
            </div>
            <div className="space-y-3">
              {(board[status] || []).map((p) => (
                <ProjectCardComponent key={p.id} project={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
