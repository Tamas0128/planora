"use client";

import { ProjektTetel } from "@/lib/api";

/** A projekt végrehajtói a tételek vállalásai szerint: ki mit visz (saját brigád, alvállalkozók, ügyfél). A beszállító/gyártó a tétel infójában szerepel. */
export default function PartnerekTab({ tetelek, onMegnyit }: { tetelek: ProjektTetel[]; onMegnyit: () => void }) {
  const csoportok = new Map<string, string[]>();
  for (const t of tetelek) {
    for (const v of t.vallalasok) {
      const kulcs = v.tipus === "sajat" ? "Ubrankovics (saját)" : v.tipus === "ugyfel" ? "Ügyfél" : v.alvallalkozo?.nev || "Alvállalkozó (név nélkül)";
      csoportok.set(kulcs, [...(csoportok.get(kulcs) ?? []), t.munkanem.nev]);
    }
  }
  const gyartok = tetelek.filter((t) => t.info && /Gyártó:|Beszállító:/.test(t.info));
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-[var(--muted)]">Ki végzi a munkákat ezen a projekten. A vállalókat a Tételek fül Részletes nézetében lehet kijelölni.</p>
      {csoportok.size === 0 && <p className="text-sm text-[var(--muted)]">Még nincs kijelölt vállaló. <button type="button" onClick={onMegnyit} className="text-[var(--primary)] underline">Tételek megnyitása</button></p>}
      <ul className="space-y-2">
        {[...csoportok.entries()].map(([nev, tl]) => (
          <li key={nev} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{nev}</h2>
              <span className="text-xs text-[var(--muted)]">{tl.length} tétel</span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{tl.join(", ")}</p>
          </li>
        ))}
      </ul>
      {gyartok.length > 0 && (
        <section aria-label="Gyártók és beszállítók">
          <h2 className="mb-1 text-sm font-semibold">Gyártók és beszállítók</h2>
          <ul className="space-y-1 text-sm">
            {gyartok.map((t) => (
              <li key={t.id}><span className="font-medium">{t.munkanem.nev}</span> <span className="text-[var(--muted)]">{t.info}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
