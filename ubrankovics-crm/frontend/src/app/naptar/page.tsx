"use client";

import AppLayout from "@/components/AppLayout";
import Morzsa from "@/components/Morzsa";
import NaptarNezet from "@/components/NaptarNezet";

export default function NaptarPage() {
  return (
    <AppLayout>
      <Morzsa elemek={[{ cimke: "Projektek", href: "/projektek" }, { cimke: "Naptár" }]} />
      <h1 className="mb-4 text-xl font-semibold">Naptár</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">Az összes projekt határidői. Egy projekt saját naptára a projekt Naptár fülén található.</p>
      <NaptarNezet />
    </AppLayout>
  );
}
