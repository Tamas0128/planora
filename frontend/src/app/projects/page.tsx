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

const STATUS_DOT: Record<string, string> = {
  planning: "bg-status-planning",
  foundation: "bg-status-foundation",
  structure: "bg-status-structure",
  exterior_done: "bg-status-exterior_done",
  turnkey: "bg-status-turnkey",
};

function ProjectCardComponent({ project }: { project: ProjectCard }) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="p-4 transition hover:shadow-md hover:ring-green-300">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground">{project.name}</h3>
          <Badge
            variant="secondary"
            className="shrink-0 text-[10px]"
            style={{ borderLeft: `3px solid var(--status-${project.status})` }}
          >
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{project.settlement}</p>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>Ügyfél: {project.client_name}</p>
          <p>Típus: {BUILDING_LABELS[project.building_type] || project.building_type}</p>
          <p>{project.floor_area_sqm} m²</p>
          {project.project_manager_name && <p>PM: {project.project_manager_name}</p>}
          {project.site_manager_name && <p>Építésvezető: {project.site_manager_name}</p>}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Átadás: {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
          </span>
          <Badge className="bg-green-100 text-green-700">{project.completion_percent}%</Badge>
        </div>
        <Progress value={project.completion_percent} className="mt-2" />
      </Card>
    </Link>
  );
}

const COLUMN_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"];

const BUILDING_OPTIONS: [string, string][] = [
  ["light_steel", "Könnyűszerkezetes"],
  ["clt", "CLT"],
  ["timber_frame", "Gerendaház"],
  ["other", "Egyéb"],
];

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
          <h1 className="text-2xl font-bold">Projektek</h1>
          <p className="text-muted-foreground">Kanban board — projekt státuszok</p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500"
        >
          <Plus /> Új projekt
        </Button>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={createProject}>
            <DialogHeader>
              <DialogTitle>Új projekt</DialogTitle>
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
              <Button
                type="submit"
                disabled={creating}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500"
              >
                {creating ? "Mentés..." : "Létrehozás"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => (
          <div key={status} className="min-w-[280px] flex-1">
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
              <span className={`size-2.5 rounded-full ${STATUS_DOT[status]}`} />
              {STATUS_LABELS[status]}
              <span className="ml-auto text-muted-foreground">
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
