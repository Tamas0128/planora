"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutList, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { api, BUILDING_LABELS, ProjectCard, STATUS_LABELS } from "@/lib/api";
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
import { cn } from "@/lib/utils";

const COLUMN_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"];

const COLUMN_CFG: Record<string, { pill: string; bar: string }> = {
  planning:      { pill: "bg-sky-500",     bar: "[&>div]:bg-sky-400" },
  foundation:    { pill: "bg-amber-500",   bar: "[&>div]:bg-amber-400" },
  structure:     { pill: "bg-orange-500",  bar: "[&>div]:bg-orange-400" },
  exterior_done: { pill: "bg-teal-500",    bar: "[&>div]:bg-teal-400" },
  turnkey:       { pill: "bg-emerald-500", bar: "[&>div]:bg-emerald-400" },
};

const BUILDING_OPTIONS: [string, string][] = [
  ["light_steel", "Könnyűszerkezetes"],
  ["clt", "CLT"],
  ["timber_frame", "Gerendaház"],
  ["other", "Egyéb"],
];

function KanbanCard({ project, status }: { project: ProjectCard; status: string }) {
  const isLate = new Date(project.delivery_date) < new Date();
  const cfg = COLUMN_CFG[status] ?? COLUMN_CFG.planning;
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className={cn(
        "cursor-pointer p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        isLate && "border-l-[3px] border-l-red-400",
      )}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {project.project_code}
        </p>
        <h3 className="mt-0.5 text-sm font-semibold leading-tight text-slate-900">{project.name}</h3>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {project.settlement} · {project.client_name}
        </p>
        <div className="mt-1.5 text-[11px] text-slate-400 space-y-0.5">
          {project.project_manager_name && <p>PM: {project.project_manager_name}</p>}
          <p>{BUILDING_LABELS[project.building_type]} · {project.floor_area_sqm} m²</p>
        </div>
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className={cn("text-[10px] font-semibold", isLate ? "text-red-500" : "text-slate-400")}>
              {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
              {isLate && " · Késik"}
            </span>
            <span className="text-[10px] font-bold text-slate-600">{project.completion_percent}%</span>
          </div>
          <Progress value={project.completion_percent} className={cn("h-1.5", cfg.bar)} />
        </div>
      </Card>
    </Link>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [board, setBoard]     = useState<Record<string, ProjectCard[]>>({});
  const [search, setSearch]   = useState("");
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => ({
    name:          "",
    project_code:  "",
    settlement:    "",
    address:       "",
    lot_number:    "",
    client_name:   "",
    client_phone:  "",
    client_email:  "",
    floor_area_sqm: 145,
    delivery_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    building_type: "light_steel",
  }));

  function load() {
    api.kanban().then(setBoard).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      payload.floor_area_sqm = Number(form.floor_area_sqm);
      if (!payload.lot_number)    payload.lot_number    = null;
      if (!payload.client_phone)  payload.client_phone  = null;
      if (!payload.client_email)  payload.client_email  = null;
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

  const totalProjects = Object.values(board).reduce((s, col) => s + col.length, 0);

  return (
    <AppLayout>
      {/* ── Fejléc ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Kanban tábla</h1>
          <p className="text-xs text-slate-500">{totalProjects} projekt összesen</p>
        </div>
        {/* Kereső */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Keresés…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
          />
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5 bg-green-700 hover:bg-green-800">
          <Plus className="size-3.5" />
          Új projekt
        </Button>
      </div>

      {/* ── Kanban board ── */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => {
          const cards = (board[status] ?? []).filter((p) =>
            !search ||
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.client_name.toLowerCase().includes(search.toLowerCase()) ||
            p.settlement.toLowerCase().includes(search.toLowerCase()),
          );
          const cfg = COLUMN_CFG[status];
          return (
            <div key={status} className="flex min-w-[260px] flex-1 flex-col">
              {/* Oszlopfejléc */}
              <div className="mb-3 flex items-center gap-2">
                <span className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white flex-1 text-center", cfg.pill)}>
                  {STATUS_LABELS[status]}
                </span>
                <span className="text-xs font-bold text-slate-500">{cards.length}</span>
              </div>
              {/* Kártyák */}
              <div className="space-y-2.5">
                {cards.map((p) => (
                  <KanbanCard key={p.id} project={p} status={status} />
                ))}
                {cards.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                    Nincs projekt
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Új projekt dialog ── */}
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
                  ["name",         "Projekt neve",      true],
                  ["project_code", "Projekt azonosító", true],
                  ["settlement",   "Település",         true],
                  ["address",      "Cím",               true],
                  ["lot_number",   "Helyrajzi szám",    false],
                  ["client_name",  "Ügyfél neve",       true],
                  ["client_phone", "Ügyfél telefon",    false],
                  ["client_email", "Ügyfél e-mail",     false],
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
    </AppLayout>
  );
}
