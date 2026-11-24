import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type MorzsaElem = { cimke: string; href?: string };

/** Morzsamenü: hol vagyunk, és egy kattintással vissza egy szintet. Az utolsó elem az aktuális oldal. */
export default function Morzsa({ elemek }: { elemek: MorzsaElem[] }) {
  return (
    <nav aria-label="Morzsamenü" className="mb-3 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-[var(--muted)]">
        {elemek.map((e, i) => {
          const utolso = i === elemek.length - 1;
          return (
            <li key={`${i}-${e.cimke}`} className="flex items-center gap-1">
              {e.href && !utolso ? (
                <Link href={e.href} className="inline-flex min-h-11 max-w-[14rem] items-center truncate text-[var(--primary)] hover:underline md:min-h-6">{e.cimke}</Link>
              ) : (
                <span aria-current={utolso ? "page" : undefined} className={`inline-block max-w-[14rem] truncate md:max-w-none ${utolso ? "text-[var(--foreground)]" : ""}`}>{e.cimke}</span>
              )}
              {!utolso && <ChevronRight size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
