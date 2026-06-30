"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  ChevronRight,
  Filter,
  HelpCircle,
  Plus,
  Search,
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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  planning:      { bg: "bg-sky-50",     text: "text-sky-700" },
  foundation:    { bg: "bg-amber-50",   text: "text-amber-700" },
  structure:     { bg: "bg-orange-50",  text: "text-orange-700" },
  exterior_done: { bg: "bg-teal-50",    text: "text-teal-700" },
  turnkey:       { bg: "bg-emerald-50", text: "text-emerald-700" },
};

const PROGRESS_COLORS: Record<string, string> = {
  planning:      "bg-sky-400",
  foundation:    "bg-amber-400",
  structure:     "bg-orange-400",
  exterior_done: "bg-teal-400",
  turnkey:       "bg-emerald-500",
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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [search, setSearch]     = useState("");
  const [showNew, setShowNew]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "", project_code: "", settlement: "", address: "",
    lot_number: "", client_name: "", client_phone: "", client_email: "",
    floor_area_sqm: 145,
    delivery_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    building_type: "light_steel",
  });

  useEffect(() => { api.projects().then(setProjects).catch(console.error); }, []);

  const filtered = projects.filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name.toLowerCase().includes(search.toLowerCase()) ||
    p.settlement.toLowerCase().includes(search.toLowerCase()) ||
    p.project_code.toLowerCase().includes(search.toLowerCase()),
  );

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
      <h1 className="text-[17px] font-bold tracking-tight text-slate-900">Projektek</h1>
      <div className="flex-1" />
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Keresés…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-56 rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-green-500 focus:bg-white focus:outline-none" />
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
    <AppLayout header={pageHeader}>
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {["planning", "foundation", "structure", "exterior_done", "turnkey"].map((s) => {
          const count = projects.filter((p) => p.status === s).length;
          const cfg = STATUS_COLORS[s];
          return (
            <div key={s} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-medium text-slate-500">{STATUS_LABELS[s]}</p>
              <p className={cn("mt-1 text-2xl font-bold", cfg?.text ?? "text-slate-900")}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Státusz</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Projekt</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ügyfél / helyszín</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Projektvezető</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Határidő</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Haladás</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-[13px] text-slate-400">
                  {search ? "Nincs találat" : "Még nincs projekt"}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const late = isLate(p.delivery_date);
              const sc = STATUS_COLORS[p.status];
              const progressColor = PROGRESS_COLORS[p.status] ?? "bg-slate-300";
              const initials = pmInitials(p.project_manager_name ?? null);
              return (
                <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", sc?.bg, sc?.text)}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-[13px] font-semibold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-400">{p.project_code}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-[13px] text-slate-700">{p.client_name}</p>
                    <p className="text-[11px] text-slate-400">{p.settlement} · {BUILDING_LABELS[p.building_type] ?? p.building_type}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    {p.project_manager_name ? (
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">
                          {initials}
                        </div>
                        <span className="text-[12px] text-slate-700">{p.project_manager_name}</span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className={cn("flex items-center gap-1.5 text-[12px]", late ? "text-red-500" : "text-slate-600")}>
                      <Calendar className="size-3 shrink-0" />
                      {new Date(p.delivery_date).toLocaleDateString("hu-HU")}
                      {late && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">Késik</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", progressColor)} style={{ width: `${p.completion_percent}%` }} />
                      </div>
                      <span className="min-w-[2.5rem] text-right text-[11px] font-medium text-slate-500">{p.completion_percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <ChevronRight className="size-4 text-slate-300" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
