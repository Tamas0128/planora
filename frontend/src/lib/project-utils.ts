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
  planning:      { leftBorder: "border-l-neutral-400", progressBar: "bg-neutral-400", badge: "bg-neutral-100 text-neutral-700", statText: "text-neutral-700" },
  foundation:    { leftBorder: "border-l-neutral-500", progressBar: "bg-neutral-500", badge: "bg-neutral-100 text-neutral-700", statText: "text-neutral-700" },
  structure:     { leftBorder: "border-l-neutral-600", progressBar: "bg-neutral-600", badge: "bg-neutral-200 text-neutral-800", statText: "text-neutral-800" },
  exterior_done: { leftBorder: "border-l-neutral-800", progressBar: "bg-neutral-800", badge: "bg-neutral-200 text-neutral-900", statText: "text-neutral-900" },
  turnkey:       { leftBorder: "border-l-accent-500",  progressBar: "bg-accent-500",  badge: "bg-accent-100 text-accent-700",   statText: "text-accent-700" },
};

export const DEFAULT_CFG = STATUS_CFG.planning;

export const ACTIVITY_STATUS_ORDER = ["pending", "in_progress", "blocked", "done"] as const;

export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  pending: "Várakozik",
  in_progress: "Folyamatban",
  blocked: "Blokkolt",
  done: "Kész",
};

export const ACTIVITY_STATUS_CFG: Record<string, { leftBorder: string; badge: string; dot: string }> = {
  pending:      { leftBorder: "border-l-neutral-300", badge: "bg-neutral-100 text-neutral-600", dot: "bg-neutral-400" },
  in_progress:  { leftBorder: "border-l-accent-400",  badge: "bg-accent-100 text-accent-700",   dot: "bg-accent-400" },
  blocked:      { leftBorder: "border-l-accent-700",  badge: "bg-accent-200 text-accent-800",   dot: "bg-accent-700" },
  done:         { leftBorder: "border-l-neutral-800", badge: "bg-neutral-200 text-neutral-900", dot: "bg-neutral-800" },
};

export const HEALTH_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  ok:       { label: "Rendben",    badge: "bg-neutral-100 text-neutral-700", dot: "bg-neutral-600" },
  warning:  { label: "Figyelendő", badge: "bg-accent-100 text-accent-700",   dot: "bg-accent-400" },
  critical: { label: "Kritikus",   badge: "bg-accent-200 text-accent-800",   dot: "bg-accent-700" },
};
