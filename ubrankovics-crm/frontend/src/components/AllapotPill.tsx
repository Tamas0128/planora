// A projekt életciklus-állapotának színes jelvénye: a szín mellett mindig szöveg is áll (nem csak színnel jelez).
export const ALLAPOT_LABEL: Record<string, string> = {
  uj: "Új",
  ajanlat: "Ajánlat",
  szerzodott: "Szerződött",
  kivitelezes: "Kivitelezés",
  lezart: "Lezárt",
};

// Az állapot jelzőszíne; ugyanez a szín a kezdőlapi diagramon is (a szerződött az agyag, a kivitelezés az erdőzöld).
export const ALLAPOT_SZIN: Record<string, string> = {
  uj: "#3a5668",
  ajanlat: "var(--warning)",
  szerzodott: "var(--critical)",
  kivitelezes: "var(--primary)",
  lezart: "var(--muted)",
};

export default function AllapotPill({ allapot }: { allapot: string }) {
  const szin = ALLAPOT_SZIN[allapot] || "var(--muted)";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: "var(--foreground)", backgroundColor: `color-mix(in srgb, ${szin} 14%, var(--card))` }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: szin }} />
      {ALLAPOT_LABEL[allapot] || allapot}
    </span>
  );
}
