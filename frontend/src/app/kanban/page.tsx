"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  ChevronDown,
  Filter,
  HelpCircle,
  MapPin,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { api, BUILDING_LABELS, ProjectCard, STATUS_LABELS } from "@/lib/api";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const COLUMN_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"];

const COLUMN_CFG: Record<string, { leftBorder: string; progressBar: string; statusBadge: string }> = {
  planning:      { leftBorder: "border-l-sky-400",     progressBar: "bg-sky-400",     statusBadge: "bg-sky-50 text-sky-700" },
  foundation:    { leftBorder: "border-l-amber-400",   progressBar: "bg-amber-400",   statusBadge: "bg-amber-50 text-amber-700" },
  structure:     { leftBorder: "border-l-orange-400",  progressBar: "bg-orange-400",  statusBadge: "bg-orange-50 text-orange-700" },
  exterior_done: { leftBorder: "border-l-teal-400",    progressBar: "bg-teal-400",    statusBadge: "bg-teal-50 text-teal-700" },
  turnkey:       { leftBorder: "border-l-emerald-500", progressBar: "bg-emerald-500", statusBadge: "bg-emerald-50 text-emerald-700" },
};

const BUILDING_OPTIONS: [string, string][] = [
  ["light_steel", "Könnyűszerkezetes"],
  ["clt", "CLT"],
  ["timber_frame", "Gerendaház"],
  ["other", "Egyéb"],
];

function pmInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function isLate(date: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date) < today;
}

function KanbanCard({
  project, status, selected, onClick,
}: {
  project: ProjectCard; status: string; selected: boolean; onClick: () => void;
}) {
  const late = isLate(project.delivery_date);
  const cfg = COLUMN_CFG[status] ?? COLUMN_CFG.planning;
  const initials = pmInitials(project.project_manager_name ?? null);

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-xl border border-l-[3px] bg-white p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
        cfg.leftBorder,
        selected ? "border-slate-200 ring-2 ring-green-500/25 shadow-md" : "border-slate-100/80",
      )}
    >
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">{project.project_code}</p>
      <h4 className="text-[13px] font-semibold leading-snug text-slate-900">{project.name}</h4>
      <p className="mt-0.5 truncate text-[11px] text-slate-500">{project.settlement} · {project.client_name}</p>
      {late && (
        <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">Késik</span>
      )}
      <div className="mt-3 flex items-center justify-between">
        <div className={cn("flex items-center gap-1 text-[11px]", late ? "text-red-400" : "text-slate-400")}>
          <Calendar className="size-3 shrink-0" />
          <span>{new Date(project.delivery_date).toLocaleDateString("hu-HU")}</span>
        </div>
        {project.project_manager_name && (
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white ring-2 ring-white">
            {initials}
          </div>
        )}
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", cfg.progressBar)} style={{ width: `${project.completion_percent}%` }} />
      </div>
    </div>
  );
}

function RightPanel({ project, onClose, onOpen }: { project: ProjectCard; onClose: () => void; onOpen: () => void }) {
  const late = isLate(project.delivery_date);
  const cfg = COLUMN_CFG[project.status] ?? COLUMN_CFG.planning;
  const initials = pmInitials(project.project_manager_name ?? null);

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-slate-100 bg-white">
      <div className="flex shrink-0 items-start justify-between border-b border-slate-100 p-4">
        <div className="min-w-0 flex-1 pr-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cfg.statusBadge)}>
              {STATUS_LABELS[project.status]}
            </span>
            {late && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">Késik</span>}
          </div>
          <h2 className="text-[14px] font-bold leading-snug text-slate-900">{project.name}</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">{project.project_code}</p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ügyfél</p>
          <p className="text-[13px] font-medium text-slate-800">{project.client_name}</p>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin className="size-3 shrink-0" /><span>{project.settlement}</span>
          </div>
        </div>

        {project.project_manager_name && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Projektvezető</p>
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">{initials}</div>
              <span className="text-[13px] font-medium text-slate-800">{project.project_manager_name}</span>
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Épület</p>
          <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
            <Package className="size-3.5 shrink-0 text-slate-400" />
            <span>{BUILDING_LABELS[project.building_type] ?? project.building_type} · {project.floor_area_sqm} m²</span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Átadási határidő</p>
          <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
            <Calendar className="size-3.5 shrink-0 text-slate-400" />
            <span className={cn(late && "font-semibold text-red-500")}>
              {new Date(project.delivery_date).toLocaleDateString("hu-HU")}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Haladás</p>
            <span className="text-[12px] font-bold text-slate-700">{project.completion_percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", cfg.progressBar)} style={{ width: `${project.completion_percent}%` }} />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-100 p-4">
        <button onClick={onOpen} className="w-full rounded-lg bg-green-700 py-2.5 text-[13px] font-semibold text-white hover:bg-green-800">
          Projekt megnyitása
        </button>
      </div>
    </aside>
  );
}

export default function KanbanPage() {
  const router = useRouter();
  const [board, setBoard]           = useState<Record<string, ProjectCard[]>>({});
  const [search, setSearch]         = useState("");
  const [showNew, setShowNew]       = useState(false);
  const [creating, setCreating]     = useState(false);
  const [selected, setSelected]     = useState<ProjectCard | null>(null);
  const [form, setForm] = useState({
    name: "", project_code: "", settlement: "", address: "",
    lot_number: "", client_name: "", client_phone: "", client_email: "",
    floor_area_sqm: 145,
    delivery_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    building_type: "light_steel",
  });

  useEffect(() => { api.kanban().then(setBoard).catch(console.error); }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, unknown> = { ...form, floor_area_sqm: Number(form.floor_area_sqm) };
      if (!payload.lot_number)   payload.lot_number   = null;
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

  const pageHeader = (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4">
      <SidebarTrigger className="text-slate-400 hover:text-slate-700" />
      <div className="h-5 w-px bg-slate-100" />
      <h1 className="text-[17px] font-bold tracking-tight text-slate-900">Kanban tábla</h1>
      <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50">
        Minden projekt <ChevronDown className="size-3.5 text-slate-400" />
      </button>
      <div className="flex-1" />
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Keresés…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-52 rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:outline-none" />
      </div>
      <button className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-600 hover:bg-slate-50">
        <Filter className="size-3.5 text-slate-400" /> Szűrő
      </button>
      <Button size="sm" onClick={() => setShowNew(true)} className="h-8 gap-1.5 bg-green-700 text-[13px] font-semibold hover:bg-green-800">
        <Plus className="size-3.5" /> Új projekt
      </Button>
      <button className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700">
        <Bell className="size-4" />
      </button>
      <button className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700">
        <HelpCircle className="size-4" />
      </button>
    </header>
  );

  return (
    <AppLayout header={pageHeader} mainClassName="flex flex-1 overflow-hidden p-0">
      <div className="flex h-full overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-auto bg-slate-50/60">
          <div className="flex min-w-max gap-5 p-6">
            {COLUMN_ORDER.map((status) => {
              const cards = (board[status] ?? []).filter((p) =>
                !search ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.client_name.toLowerCase().includes(search.toLowerCase()) ||
                p.settlement.toLowerCase().includes(search.toLowerCase()),
              );
              return (
                <div key={status} className="flex w-[268px] shrink-0 flex-col">
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="flex-1 text-[13px] font-semibold text-slate-700">{STATUS_LABELS[status]}</h3>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-50 px-1.5 text-[11px] font-bold text-emerald-700">{cards.length}</span>
                  </div>
                  <div className="mb-3.5 h-px bg-slate-200/70" />
                  <div className="flex flex-col gap-2.5">
                    {cards.map((p) => (
                      <KanbanCard key={p.id} project={p} status={status}
                        selected={selected?.id === p.id}
                        onClick={() => setSelected(selected?.id === p.id ? null : p)} />
                    ))}
                    {cards.length === 0 && (
                      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-10">
                        <p className="text-[12px] text-slate-400">Nincs projekt</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowNew(true)}
                    className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-2 text-[12px] text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <Plus className="size-3.5" /> Projekt hozzáadása
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        {selected && (
          <RightPanel project={selected} onClose={() => setSelected(null)}
            onOpen={() => router.push(`/projects/${selected.id}`)} />
        )}
      </div>

      {/* New project dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={createProject}>
            <DialogHeader>
              <DialogTitle>Új projekt</DialogTitle>
              <DialogDescription>Töltsd ki az adatokat az ütemterv automatikus generálásához.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              {([
                ["name", "Projekt neve", true], ["project_code", "Projekt azonosító", true],
                ["settlement", "Település", true], ["address", "Cím", true],
                ["lot_number", "Helyrajzi szám", false], ["client_name", "Ügyfél neve", true],
                ["client_phone", "Ügyfél telefon", false], ["client_email", "Ügyfél e-mail", false],
              ] as const).map(([key, label, required]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input id={key} required={required} value={form[key] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="floor_area_sqm">Alapterület (m²)</Label>
                <Input id="floor_area_sqm" type="number" required value={form.floor_area_sqm}
                  onChange={(e) => setForm({ ...form, floor_area_sqm: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delivery_date">Átadási határidő</Label>
                <Input id="delivery_date" type="date" required value={form.delivery_date}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
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
    </AppLayout>
  );
}
