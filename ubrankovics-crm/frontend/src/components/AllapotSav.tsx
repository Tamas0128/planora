import Link from "next/link";

export type AllapotSor = { kulcs: string; cimke: string; ertek: number; szin: string };

/** Állapot szerinti megoszlás: egy lapos arány-sáv, alatta soronként a darabszám és a szűrt projektlistára vivő link. */
export default function AllapotSav({ sorok, osszes }: { sorok: AllapotSor[]; osszes: number }) {
  const lathato = sorok.filter((s) => s.ertek > 0);
  if (osszes === 0) return <p className="text-sm text-[var(--muted)]">Még nincs projekt.</p>;
  return (
    <div>
      <div
        role="img"
        aria-label={`Projektek állapot szerint, összesen ${osszes}: ${lathato.map((s) => `${s.cimke} ${s.ertek}`).join(", ")}`}
        className="flex h-3 overflow-hidden rounded-full bg-[var(--border)]"
      >
        {lathato.map((s) => (
          <div key={s.kulcs} style={{ width: `${(s.ertek / osszes) * 100}%`, background: s.szin, minWidth: "3px" }} />
        ))}
      </div>
      <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
        {lathato.map((s) => (
          <li key={s.kulcs}>
            <Link href={`/projektek?allapot=${s.kulcs}`} className="flex min-h-11 items-center gap-2 md:min-h-9">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.szin }} />
              <span className="flex-1">{s.cimke}</span>
              <span className="font-semibold tabular-nums">{s.ertek}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
