import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Trims every string field of a flat form object and converts an
// empty/whitespace-only result to null, so a save payload only sends real
// values or explicit clears — used by the master-data CRUD pages (partners,
// own-companies) whose forms are all string-keyed text inputs.
export function trimmedPayload<T extends Record<string, string>>(form: T): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim() === "" ? null : value.trim()])
  );
}
