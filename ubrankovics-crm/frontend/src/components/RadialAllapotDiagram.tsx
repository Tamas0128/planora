"use client";

import { useEffect, useState } from "react";

export type RadialSor = { kulcs: string; cimke: string; ertek: number; szin: string };

const MERET = 220;
const KOZEP = MERET / 2;
const SUGAR_KULSO = 100;
const SAV = 16; // két gyűrű közepének távolsága
const VASTAGSAG = 11;
const SZOG = 0.75; // a teljes kör hányada: 270°

/** Koncentrikus ívdiagram: minden sor egy gyűrű, az ív hossza az értékkel arányos (a legnagyobb érték a teljes 270°). */
export default function RadialAllapotDiagram({ sorok, osszes }: { sorok: RadialSor[]; osszes: number }) {
  const [latszik, setLatszik] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLatszik(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(1, ...sorok.map((s) => s.ertek));

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
      <svg
        viewBox={`0 0 ${MERET} ${MERET}`}
        className="h-56 w-56 shrink-0"
        role="img"
        aria-label={`Projektek állapot szerint, összesen ${osszes}: ${sorok.map((s) => `${s.cimke} ${s.ertek}`).join(", ")}`}
      >
        {sorok.map((s, i) => {
          const r = SUGAR_KULSO - i * SAV;
          const arany = (s.ertek / max) * SZOG * 100;
          return (
            <g key={s.kulcs} transform={`translate(${KOZEP} ${KOZEP}) scale(-1 1) rotate(-90)`}>
              <circle r={r} fill="none" stroke="var(--border)" strokeWidth={VASTAGSAG} pathLength={100} strokeDasharray={`${SZOG * 100} 100`} strokeLinecap="round" opacity={0.55} />
              {s.ertek > 0 && (
                <circle
                  r={r}
                  fill="none"
                  stroke={s.szin}
                  strokeWidth={VASTAGSAG}
                  pathLength={100}
                  strokeDasharray={`${latszik ? arany : 0.001} 100`}
                  strokeLinecap="round"
                  style={{ transition: `stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms` }}
                />
              )}
            </g>
          );
        })}
      </svg>
      <ul className="space-y-2 text-sm">
        {sorok.map((s) => (
          <li key={s.kulcs} className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: s.szin }} aria-hidden="true" />
            <span className="min-w-24 font-medium">{s.cimke}</span>
            <span className="ml-auto font-heading text-base font-bold tabular-nums">{s.ertek}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
