import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CircleDot,
  DoorOpen,
  FileText,
  Grid2x2,
  Hammer,
  Layers,
  PaintRoller,
  PencilRuler,
  Shield,
  TreePine,
  Trees,
  Truck,
  Wrench,
  Zap,
  Home as HomeIcon,
} from "lucide-react";
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
  planning:      { leftBorder: "border-l-accent-300", progressBar: "bg-accent-300", badge: "bg-neutral-100 text-neutral-700",  statText: "text-neutral-700" },
  foundation:    { leftBorder: "border-l-accent-400", progressBar: "bg-accent-400", badge: "bg-accent-100 text-accent-700",   statText: "text-accent-700" },
  structure:     { leftBorder: "border-l-accent-500", progressBar: "bg-accent-500", badge: "bg-accent-100 text-accent-700",   statText: "text-accent-700" },
  exterior_done: { leftBorder: "border-l-accent-600", progressBar: "bg-accent-600", badge: "bg-accent-200 text-accent-800",   statText: "text-accent-800" },
  turnkey:       { leftBorder: "border-l-accent-700", progressBar: "bg-accent-700", badge: "bg-accent-200 text-accent-800",   statText: "text-accent-800" },
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
  pending:      { leftBorder: "border-l-neutral-300",  badge: "bg-neutral-100 text-neutral-600",   dot: "bg-neutral-400" },
  in_progress:  { leftBorder: "border-l-accent-500",   badge: "bg-accent-100 text-accent-700",     dot: "bg-accent-500" },
  blocked:      { leftBorder: "border-l-critical",     badge: "bg-critical-bg text-critical",      dot: "bg-critical" },
  done:         { leftBorder: "border-l-neutral-800",  badge: "bg-neutral-200 text-neutral-900",   dot: "bg-neutral-800" },
};

export const HEALTH_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  ok:       { label: "Rendben",    badge: "bg-accent-100 text-accent-700",     dot: "bg-accent-600" },
  warning:  { label: "Figyelendő", badge: "bg-warning-bg text-warning-foreground", dot: "bg-warning" },
  critical: { label: "Kritikus",   badge: "bg-critical-bg text-critical",      dot: "bg-critical" },
};

export const CATEGORY_ORDER = [
  "foundation", "timber_frame", "roofing", "exterior_openings", "electrical",
  "mechanical", "insulation", "flooring", "interior", "finishing", "facade",
  "landscaping", "procurement", "planning", "documentation", "other",
] as const;

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  foundation: Layers,
  timber_frame: TreePine,
  roofing: HomeIcon,
  exterior_openings: DoorOpen,
  electrical: Zap,
  mechanical: Wrench,
  insulation: Shield,
  flooring: Grid2x2,
  interior: Hammer,
  finishing: PaintRoller,
  facade: Building2,
  landscaping: Trees,
  procurement: Truck,
  planning: PencilRuler,
  documentation: FileText,
  other: CircleDot,
};

export const DOCUMENTATION_SUBTYPE_ORDER = [
  "contract", "purchase_order", "completion_certificate", "invoice", "plan", "letter_of_intent",
] as const;
