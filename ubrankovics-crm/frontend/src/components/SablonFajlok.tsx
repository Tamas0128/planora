"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { api, SablonLista, UserResponse } from "@/lib/api";

const TIPUS_LABEL: Record<string, string> = {
  ajanlatkeres: "Ajánlatkérés",
  ajanlat: "Ajánlat",
  megrendeles: "Megrendelés",
  szerzodes: "Szerződés",
  tig: "Teljesítésigazolás (TIG)",
};

const meretSzoveg = (b?: number | null) => (b ? `${Math.max(1, Math.round(b / 1024))} KB` : "");

/** Törzsadatok → Dokumentumsablonok: típusonként egy feltöltött .docx; a projektoldalon ebből generálunk. */
export default function SablonFajlok() {
  const [lista, setLista] = useState<SablonLista | null>(null);
  const [me, setMe] = useState<UserResponse | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(() => {
    api.listSablonfajlok().then(setLista).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    api.me().then(setMe).catch(() => {});
  }, [load]);

  const szerkeszthet = me?.role === "admin" || me?.role === "vezetes";

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setError("");
    setInfo("");
    try {
      await fn();
      if (ok) setInfo(ok);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,40rem)_1fr]">
      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          Tölts fel típusonként egy Word (.docx) sablont. A szövegében {"{{ projekt_nev }}"}-szerű helyőrzők kapnak értéket, amikor a
          projekt Tételek lapján a „DOCX generálása” gombot használod.
          {!szerkeszthet && " Feltölteni csak admin és vezetés szerepkörrel lehet."}
        </p>
        {error && <div role="alert" className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
        {info && <div role="status" className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">{info}</div>}
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" data-testid="sablon-lista">
          {lista?.sablonok.map((s) => (
            <li key={s.tipus} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" data-testid={`sablon-${s.tipus}`}>
              <div>
                <div className="font-medium">{TIPUS_LABEL[s.tipus] || s.tipus}</div>
                <div className="text-[var(--muted)]">
                  {s.feltoltve ? `${s.eredeti_nev} · ${meretSzoveg(s.meret)}` : "Nincs feltöltött sablon"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {s.feltoltve && (
                  <button
                    onClick={() => run(() => api.downloadSablonfajl(s.tipus, s.eredeti_nev || "sablon.docx"))}
                    className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    <Download size={12} /> Letöltés
                  </button>
                )}
                {szerkeszthet && (
                  <>
                    <label className="flex min-h-9 cursor-pointer items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1 text-xs text-[var(--primary-foreground)]">
                      <Upload size={12} /> {s.feltoltve ? "Csere" : "Feltöltés"}
                      <input
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="sr-only"
                        aria-label={`${TIPUS_LABEL[s.tipus] || s.tipus} sablon feltöltése`}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) run(() => api.uploadSablonfajl(s.tipus, f), `${TIPUS_LABEL[s.tipus]} sablon feltöltve.`);
                        }}
                      />
                    </label>
                    {s.feltoltve && (
                      <button
                        aria-label={`${TIPUS_LABEL[s.tipus] || s.tipus} sablon törlése`}
                        onClick={() => confirm("Törlöd a sablont?") && run(() => api.deleteSablonfajl(s.tipus))}
                        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-[var(--danger)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <section className="h-fit rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4" aria-labelledby="valtozok-cim">
        <h2 id="valtozok-cim" className="mb-2 text-sm font-semibold">Használható helyőrzők</h2>
        <p className="mb-2 text-xs text-[var(--muted)]">A sablon Word-ben szerkeszthető, a helyőrzőket szövegként írd be, formázással együtt.</p>
        <dl className="space-y-1 text-sm">
          {lista?.valtozok.map((v) => (
            <div key={v.nev} className="flex flex-wrap gap-x-2">
              <dt className="font-mono text-xs">{v.nev.startsWith("t.") ? `{{ ${v.nev} }}` : v.nev === "tetelek" ? "tetelek" : `{{ ${v.nev} }}`}</dt>
              <dd className="text-[var(--muted)]">{v.leiras}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
