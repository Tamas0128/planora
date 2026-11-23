"use client";

import { CalendarDays } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import NaptarNezet from "@/components/NaptarNezet";

export default function NaptarPage() {
  return (
    <AppLayout>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <CalendarDays size={20} /> Naptár
      </h1>
      <p className="mb-4 text-sm text-[var(--muted)]">Az összes projekt határidői. Egy projekt saját naptára a projekt Naptár fülén található.</p>
      <NaptarNezet />
    </AppLayout>
  );
}
