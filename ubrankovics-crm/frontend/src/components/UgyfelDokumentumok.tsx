"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, File, FileBadge, FileText, Image as ImageIcon, PenTool, type LucideIcon } from "lucide-react";
import { api, downloadFile, UgyfelDokumentum } from "@/lib/api";

const TIPUS: Record<string, { cimke: string; Ikon: LucideIcon; szin: string }> = {
  szerzodes: { cimke: "Szerződés", Ikon: FileText, szin: "var(--primary)" },
  tervrajz: { cimke: "Tervrajz", Ikon: PenTool, szin: "#3a5668" },
  engedely: { cimke: "Engedély", Ikon: FileBadge, szin: "var(--warning)" },
  fenykep: { cimke: "Fénykép", Ikon: ImageIcon, szin: "var(--color-neutral-600)" },
  egyeb: { cimke: "Egyéb", Ikon: File, szin: "var(--muted)" },
};
const SORREND = ["szerzodes", "tervrajz", "engedely", "fenykep", "egyeb"];

function meret(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Az ügyfél projektjeihez feltöltött dokumentumok egy helyen: szerződések, tervek, engedélyek, fényképek. */
export default function UgyfelDokumentumok({ ugyfelId }: { ugyfelId: number }) {
  const [lista, setLista] = useState<UgyfelDokumentum[] | null>(null);
  const [hiba, setHiba] = useState("");

  useEffect(() => {
    api.listUgyfelDokumentumok(ugyfelId).then(setLista).catch((e) => {
      setHiba(e instanceof Error ? e.message : "Hiba");
      setLista([]);
    });
  }, [ugyfelId]);

  const csoportok = SORREND.map((k) => ({ k, sorok: (lista ?? []).filter((d) => (TIPUS[d.tipus] ? d.tipus : "egyeb") === k) })).filter((c) => c.sorok.length > 0);

  return (
    <section aria-labelledby="ugyfel-dok" className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="ugyfel-dok" className="text-sm font-semibold">Dokumentumok</h2>
        {lista && lista.length > 0 && <span className="text-xs text-[var(--muted)]">{lista.length} fájl az ügyfél projektjeiből</span>}
      </div>
      {hiba && <p role="alert" className="mb-2 text-sm text-[var(--danger)]">{hiba}</p>}
      {lista === null ? (
        <div role="status" aria-label="Dokumentumok betöltése" className="h-20 animate-pulse rounded-[var(--radius)] bg-[var(--border)]" />
      ) : lista.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Még nincs dokumentum. A szerződések, tervek, engedélyek és fényképek a projekt Dokumentumok fülén tölthetők fel, és itt is megjelennek.
        </p>
      ) : (
        <div className="space-y-4">
          {csoportok.map(({ k, sorok }) => {
            const { cimke, Ikon, szin } = TIPUS[k];
            return (
              <div key={k}>
                <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: szin }}
                    aria-hidden="true"
                  >
                    <Ikon size={13} />
                  </span>
                  {cimke} ({sorok.length})
                </h3>
                <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
                  {sorok.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{d.eredeti_nev || "Névtelen fájl"}</div>
                        <div className="text-xs text-[var(--muted)]">
                          <Link href={`/projektek/${d.projekt_id}`} className="text-[var(--primary)] hover:underline">
                            {d.projekt_nev}
                          </Link>
                          {" · "}
                          {new Date(d.created_at).toLocaleDateString("hu-HU")}
                          {meret(d.meret) ? ` · ${meret(d.meret)}` : ""}
                          {d.megjegyzes ? ` · ${d.megjegyzes}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadFile(`/projektek/${d.projekt_id}/dokumentumok/${d.id}/letoltes`, d.eredeti_nev || `dokumentum-${d.id}`).catch((e) => setHiba(e instanceof Error ? e.message : "Letöltési hiba"))}
                        aria-label={`${d.eredeti_nev || "Dokumentum"} letöltése`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--primary)] hover:bg-[var(--color-accent-100)] md:h-9 md:w-9"
                      >
                        <Download size={17} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
