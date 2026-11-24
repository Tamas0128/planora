"use client";

import { useState } from "react";
import { api, ProjektTetel, TetelEsemeny } from "@/lib/api";

const OSZLOPOK: { tipus: string; cimke: string }[] = [
  { tipus: "ajanlatkeres", cimke: "Ajánlatkérés" },
  { tipus: "ajanlat_beerkezett", cimke: "Ajánlat beérkezett" },
  { tipus: "ajanlat_ugyfelnek", cimke: "Ajánlat ügyfélnek" },
  { tipus: "ajanlat_alairva", cimke: "Ügyfél aláírta" },
  { tipus: "szerzodes", cimke: "Szerződtünk" },
  { tipus: "anyag_megrendelve", cimke: "Anyag rendelve" },
  { tipus: "anyag_megerkezett", cimke: "Megjött" },
  { tipus: "munka_kesz", cimke: "Elvégezve" },
];

// kattintásra ez a sorrend: üres → folyamatban → kész → nem releváns → üres
const KOVETKEZO: Record<string, string | null> = { "": "folyamatban", nyitott: "folyamatban", folyamatban: "kesz", kesz: "nem_relevans", nem_relevans: null };
const MEGJELENIT: Record<string, { szoveg: string; cls: string }> = {
  "": { szoveg: "·", cls: "text-[var(--muted)]" },
  nyitott: { szoveg: "nyitott", cls: "text-[var(--muted)]" },
  folyamatban: { szoveg: "folyamatban", cls: "bg-[var(--warning-bg)] text-[var(--warning-fg)] px-1.5 rounded-full" },
  kesz: { szoveg: "igen", cls: "text-[var(--positive)] font-medium" },
  nem_relevans: { szoveg: "–", cls: "text-[var(--muted)]" },
};

function csoport(t: ProjektTetel): "alap" | "ajanlati" | "cr" {
  if (t.potmunka) return "cr";
  const szerz = t.esemenyek.find((e) => e.tipus === "szerzodes")?.allapot === "kesz";
  return szerz || ["szerzodes", "beszerzes", "kivitelezes", "kesz"].includes(t.szakasz) ? "alap" : "ajanlati";
}

const CSOPORT_CIM: Record<string, string> = {
  alap: "Alapszerződés (MVP): szerződött tételek",
  ajanlati: "Ajánlati szakasz: még nincs szerződve",
  cr: "Pótmunka (CR): szerződésmódosítással",
};

function vegrehajto(t: ProjektTetel): string {
  const neve = t.vallalasok.map((v) => (v.tipus === "sajat" ? "Ubr." : v.tipus === "ugyfel" ? "Ügyfél" : v.alvallalkozo?.nev || "Alváll.")).join(", ");
  return neve || "—";
}

export default function TetelFolyamat({ projektId, tetelek, onChange }: { projektId: number; tetelek: ProjektTetel[]; onChange: () => void }) {
  const [hiba, setHiba] = useState("");

  async function leptet(t: ProjektTetel, tipus: string) {
    setHiba("");
    const e: TetelEsemeny | undefined = t.esemenyek.find((x) => x.tipus === tipus);
    const kov = KOVETKEZO[e?.allapot ?? ""];
    try {
      if (!e && kov) await api.addEsemeny(projektId, t.id, { tipus, allapot: kov });
      else if (e && kov) await api.updateEsemeny(projektId, t.id, e.id, { allapot: kov });
      else if (e) await api.removeEsemeny(projektId, t.id, e.id);
      onChange();
    } catch (err) {
      setHiba(err instanceof Error ? err.message : "Hiba a mentéskor");
    }
  }

  const csoportok = (["alap", "ajanlati", "cr"] as const).map((k) => ({ k, sorok: tetelek.filter((t) => csoport(t) === k) })).filter((c) => c.sorok.length > 0);

  return (
    <div>
      {hiba && <div role="alert" className="mb-2 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{hiba}</div>}
      <p className="mb-2 text-xs text-[var(--muted)]">Egy cellára kattintva lép tovább az állapot: üres → folyamatban → igen → nem releváns (–) → üres.</p>
      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]" data-testid="tetel-folyamat">
        <table className="w-full min-w-[820px] text-xs">
          <thead>
            <tr className="text-left text-[var(--muted)]">
              <th className="px-3 py-2 font-medium">Tétel</th>
              <th className="px-2 py-2 font-medium">Ubr. / alváll.</th>
              {OSZLOPOK.map((o) => (
                <th key={o.tipus} className="px-1 py-2 text-center font-medium">{o.cimke}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csoportok.map(({ k, sorok }) => (
              <FolyamatCsoport key={k} cim={CSOPORT_CIM[k]} sorok={sorok} leptet={leptet} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FolyamatCsoport({ cim, sorok, leptet }: { cim: string; sorok: ProjektTetel[]; leptet: (t: ProjektTetel, tipus: string) => void }) {
  return (
    <>
      <tr>
        <td colSpan={2 + OSZLOPOK.length} className="bg-[var(--muted-bg)] px-3 py-1.5 text-xs font-semibold">{cim}</td>
      </tr>
      {sorok.map((t) => (
        <tr key={t.id} className="border-t border-[var(--border)]">
          <td className="px-3 py-1.5 font-medium">
            {t.munkanem.nev}
            {t.cr_azonosito && <span className="ml-1 text-[var(--muted)]">({t.cr_azonosito})</span>}
          </td>
          <td className="px-2 py-1.5 text-[var(--muted)]">{vegrehajto(t)}</td>
          {OSZLOPOK.map((o) => {
            const allapot = t.esemenyek.find((e) => e.tipus === o.tipus)?.allapot ?? "";
            const m = MEGJELENIT[allapot] ?? MEGJELENIT[""];
            return (
              <td key={o.tipus} className="px-1 py-0.5 text-center">
                <button
                  type="button"
                  onClick={() => leptet(t, o.tipus)}
                  aria-label={`${t.munkanem.nev}, ${o.cimke}: ${allapot ? m.szoveg : "üres"}`}
                  className="min-h-9 w-full min-w-[3.5rem] rounded-[var(--radius-sm)] px-1 hover:bg-[var(--color-accent-100)]"
                >
                  <span className={m.cls}>{m.szoveg}</span>
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
