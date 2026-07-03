import { BUILDING_LABELS } from "@/lib/api";

export function pmInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function isLate(date: string): boolean {
  return date < new Date().toISOString().split("T")[0];
}

export function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export const BUILDING_OPTIONS: [string, string][] = Object.entries(BUILDING_LABELS) as [string, string][];

export const STATUS_ORDER = ["planning", "foundation", "structure", "exterior_done", "turnkey"] as const;

export const STATUS_CFG: Record<string, {
  leftBorder: string;
  progressBar: string;
  badge: string;
  statText: string;
}> = {
  planning:      { leftBorder: "border-l-sky-400",     progressBar: "bg-sky-400",     badge: "bg-sky-50 text-sky-700",         statText: "text-sky-700" },
  foundation:    { leftBorder: "border-l-amber-400",   progressBar: "bg-amber-400",   badge: "bg-amber-50 text-amber-700",     statText: "text-amber-700" },
  structure:     { leftBorder: "border-l-orange-400",  progressBar: "bg-orange-400",  badge: "bg-orange-50 text-orange-700",   statText: "text-orange-700" },
  exterior_done: { leftBorder: "border-l-teal-400",    progressBar: "bg-teal-400",    badge: "bg-teal-50 text-teal-700",       statText: "text-teal-700" },
  turnkey:       { leftBorder: "border-l-emerald-500", progressBar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", statText: "text-emerald-700" },
};

export const DEFAULT_CFG = STATUS_CFG.planning;
