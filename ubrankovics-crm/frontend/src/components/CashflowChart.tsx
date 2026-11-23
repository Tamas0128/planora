"use client";

import { useId, useMemo, useState } from "react";
import { CashflowBucket } from "@/lib/api";

// A diagram a rendszer meleg palettájából dolgozik: erdőzöld bevétel, agyag kiadás, kéreg-barna egyenleg.
// A tervezett sávok csíkozott kitöltést kapnak (nem csak világosabb árnyalatot), így színvakon is elkülönülnek.
const COLOR = {
  bevetel: "#2f6b3b",
  bevetelSoft: "#e8f0e9",
  kiadas: "#a24a33",
  kiadasSoft: "#f6e4dc",
  zaro: "#453d2e",
  zaroNegativ: "#a24a33",
  grid: "#e6dcc6",
  baseline: "#a89b7c",
  mutedInk: "#6b6049",
  ink: "#2b271f",
  today: "#b8873a",
};

const HONAP = ["jan", "feb", "már", "ápr", "máj", "jún", "júl", "aug", "szep", "okt", "nov", "dec"];

function huf(v: number) {
  return `${Math.round(v).toLocaleString("hu-HU")} Ft`;
}

/** Tengelycímke: 1 200 000 → "1,2 M", 45 000 → "45 e". */
function rovid(v: number) {
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M`;
  return `${Math.round(v / 1000).toLocaleString("hu-HU")} e`;
}

function niceStep(max: number): number {
  if (max <= 0) return 1;
  const rough = max / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * pow;
}

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Lekerekített tetejű (vagy alsó) sáv — az alapvonalnál éles marad, mint egy kitöltött oszlop. */
function barPath(x: number, w: number, yTop: number, yBottom: number, round: "top" | "bottom", r = 4) {
  const h = Math.abs(yBottom - yTop);
  const rr = Math.min(r, w / 2, h);
  if (round === "top") {
    return `M ${x} ${yBottom} V ${yTop + rr} Q ${x} ${yTop} ${x + rr} ${yTop} H ${x + w - rr} Q ${x + w} ${yTop} ${x + w} ${yTop + rr} V ${yBottom} Z`;
  }
  return `M ${x} ${yTop} V ${yBottom - rr} Q ${x} ${yBottom} ${x + rr} ${yBottom} H ${x + w - rr} Q ${x + w} ${yBottom} ${x + w} ${yBottom - rr} V ${yTop} Z`;
}

export default function CashflowChart({ bucketek }: { bucketek: CashflowBucket[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const width = 900;
  const marginLeft = 56;
  const marginRight = 20;
  const flowHeight = 180;
  const balanceHeight = 130;
  const gapBetween = 34;
  const bottomAxisHeight = 40;
  const plotWidth = width - marginLeft - marginRight;

  const n = bucketek.length;
  const slot = n > 0 ? plotWidth / n : plotWidth;
  const barWidth = Math.max(6, Math.min(26, slot * 0.58));

  const flow = useMemo(() => {
    const maxUp = Math.max(0, ...bucketek.map((b) => Number(b.bevetel_teny) + Number(b.bevetel_terv)));
    const maxDown = Math.max(0, ...bucketek.map((b) => Number(b.kiadas_teny) + Number(b.kiadas_terv)));
    const max = Math.max(maxUp, maxDown, 1);
    const step = niceStep(max);
    const axisMax = Math.ceil(max / step) * step || step;
    return { axisMax, step };
  }, [bucketek]);

  const balance = useMemo(() => {
    const values = bucketek.map((b) => Number(b.zaro));
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values, 1);
    const step = niceStep(Math.max(Math.abs(min), max));
    const axisMax = Math.ceil(max / step) * step || step;
    const axisMin = Math.floor(min / step) * step;
    return { axisMin, axisMax, step };
  }, [bucketek]);

  const osszegzes = useMemo(() => {
    if (bucketek.length === 0) return null;
    let min = bucketek[0];
    for (const b of bucketek) if (Number(b.zaro) < Number(min.zaro)) min = b;
    return {
      zaro: Number(bucketek[bucketek.length - 1].zaro),
      min: Number(min.zaro),
      minDatum: min.kezdo_datum,
      netto: bucketek.reduce((acc, b) => acc + Number(b.netto), 0),
    };
  }, [bucketek]);

  if (n === 0) return null;

  const flowY = (v: number) => flowHeight / 2 - (v / flow.axisMax) * (flowHeight / 2 - 6);
  const balanceRange = balance.axisMax - balance.axisMin || 1;
  const balanceY = (v: number) => 6 + (balanceHeight - 12) - ((v - balance.axisMin) / balanceRange) * (balanceHeight - 12);
  const zeroBal = balanceY(0);

  const flowGridLines = [-flow.axisMax, -flow.axisMax / 2, 0, flow.axisMax / 2, flow.axisMax];
  const balanceGridValues: number[] = [];
  for (let v = balance.axisMin; v <= balance.axisMax + 0.001; v += balance.step) balanceGridValues.push(v);

  const linePoints = bucketek.map((b, i) => ({
    x: marginLeft + slot * i + slot / 2,
    y: balanceY(Number(b.zaro)),
    v: Number(b.zaro),
    negativ: b.negativ,
  }));
  const linePath = linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${linePoints[n - 1].x} ${zeroBal} L ${linePoints[0].x} ${zeroBal} Z`;

  // "ma" jelölés, ha a mai nap az időszakba esik
  const mostISO = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  let todayX: number | null = null;
  bucketek.forEach((b, i) => {
    if (b.kezdo_datum <= mostISO && mostISO <= b.vege_datum) {
      const t0 = parseDate(b.kezdo_datum).getTime();
      const t1 = parseDate(b.vege_datum).getTime() + 86400000;
      const frac = (parseDate(mostISO).getTime() - t0) / (t1 - t0);
      todayX = marginLeft + slot * (i + frac);
    }
  });

  const hovered = hoverIdx !== null ? bucketek[hoverIdx] : null;
  const havi = n > 1 && parseDate(bucketek[1].kezdo_datum).getTime() - parseDate(bucketek[0].kezdo_datum).getTime() > 27 * 86400000;
  const minPont = linePoints.reduce((m, p) => (p.v < m.v ? p : m), linePoints[0]);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      {osszegzes && (
        <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-3 border-b border-[var(--border)] pb-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--muted)]">Záró egyenleg az időszak végén</dt>
            <dd className={`font-heading text-2xl font-bold ${osszegzes.zaro < 0 ? "text-[var(--danger)]" : ""}`}>{huf(osszegzes.zaro)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Mélypont ({osszegzes.minDatum})</dt>
            <dd className={`font-heading text-2xl font-bold ${osszegzes.min < 0 ? "text-[var(--danger)]" : ""}`}>{huf(osszegzes.min)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Nettó pénzmozgás</dt>
            <dd className={`font-heading text-2xl font-bold ${osszegzes.netto < 0 ? "text-[var(--danger)]" : "text-[var(--positive)]"}`}>
              {osszegzes.netto > 0 ? "+" : ""}
              {huf(osszegzes.netto)}
            </dd>
          </div>
        </dl>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
        <LegendSwatch fill={COLOR.bevetel} label="Bevétel (tényleges)" />
        <LegendSwatch fill={`url(#${uid}-hb)`} edge={COLOR.bevetel} label="Bevétel (tervezett)" />
        <LegendSwatch fill={COLOR.kiadas} label="Kiadás (tényleges)" />
        <LegendSwatch fill={`url(#${uid}-hk)`} edge={COLOR.kiadas} label="Kiadás (tervezett)" />
        <LegendSwatch fill={COLOR.zaro} label="Záró egyenleg" line />
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${flowHeight + gapBetween + balanceHeight + bottomAxisHeight}`}
          className="w-full"
          role="img"
          aria-label="Gördülő cash-flow diagram: bevétel és kiadás időszakonként, alatta a göngyölített záró egyenleg"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <pattern id={`${uid}-hb`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={COLOR.bevetelSoft} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={COLOR.bevetel} strokeWidth="2.2" opacity="0.55" />
            </pattern>
            <pattern id={`${uid}-hk`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={COLOR.kiadasSoft} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={COLOR.kiadas} strokeWidth="2.2" opacity="0.55" />
            </pattern>
            <clipPath id={`${uid}-pos`}>
              <rect x={marginLeft} y={0} width={plotWidth} height={Math.max(0, zeroBal)} />
            </clipPath>
            <clipPath id={`${uid}-neg`}>
              <rect x={marginLeft} y={zeroBal} width={plotWidth} height={Math.max(0, balanceHeight - zeroBal)} />
            </clipPath>
          </defs>

          {/* hover oszlop-sáv az egész magasságon */}
          {hoverIdx !== null && (
            <rect
              x={marginLeft + slot * hoverIdx}
              y={0}
              width={slot}
              height={flowHeight + gapBetween + balanceHeight}
              rx={6}
              fill={COLOR.zaro}
              opacity={0.05}
            />
          )}

          {/* --- Bevétel / kiadás --- */}
          <g>
            {flowGridLines.map((v) => (
              <g key={v}>
                <line
                  x1={marginLeft}
                  x2={width - marginRight}
                  y1={flowY(v)}
                  y2={flowY(v)}
                  stroke={v === 0 ? COLOR.baseline : COLOR.grid}
                  strokeWidth={v === 0 ? 1.25 : 1}
                  strokeDasharray={v === 0 ? undefined : "2 4"}
                />
                <text x={marginLeft - 10} y={flowY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={COLOR.mutedInk}>
                  {rovid(v)}
                </text>
              </g>
            ))}
            {bucketek.map((b, i) => {
              const cx = marginLeft + slot * i + slot / 2;
              const x = cx - barWidth / 2;
              const bevTeny = Number(b.bevetel_teny);
              const bevTerv = Number(b.bevetel_terv);
              const kiaTeny = Number(b.kiadas_teny);
              const kiaTerv = Number(b.kiadas_terv);
              const zero = flowY(0);
              const delay = { animationDelay: `${i * 25}ms` };
              return (
                <g key={b.kezdo_datum} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: "pointer" }}>
                  <rect x={marginLeft + slot * i} y={0} width={slot} height={flowHeight} fill="transparent" />
                  {bevTeny > 0 && (
                    <path
                      className="cf-grow-up"
                      style={delay}
                      d={barPath(x, barWidth, flowY(bevTeny), zero, bevTerv > 0 ? "bottom" : "top", bevTerv > 0 ? 0 : 4)}
                      fill={COLOR.bevetel}
                    />
                  )}
                  {bevTerv > 0 && (
                    <path
                      className="cf-grow-up"
                      style={delay}
                      d={barPath(x, barWidth, flowY(bevTeny + bevTerv), flowY(bevTeny), "top")}
                      fill={`url(#${uid}-hb)`}
                      stroke={COLOR.bevetel}
                      strokeWidth={1}
                    />
                  )}
                  {kiaTeny > 0 && (
                    <path
                      className="cf-grow-down"
                      style={delay}
                      d={barPath(x, barWidth, zero, flowY(-kiaTeny), "bottom", kiaTerv > 0 ? 0 : 4)}
                      fill={COLOR.kiadas}
                    />
                  )}
                  {kiaTerv > 0 && (
                    <path
                      className="cf-grow-down"
                      style={delay}
                      d={barPath(x, barWidth, flowY(-kiaTeny), flowY(-kiaTeny - kiaTerv), "bottom")}
                      fill={`url(#${uid}-hk)`}
                      stroke={COLOR.kiadas}
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* --- Záró egyenleg --- */}
          <g transform={`translate(0 ${flowHeight + gapBetween})`}>
            {balanceGridValues.map((v) => (
              <g key={v}>
                <line
                  x1={marginLeft}
                  x2={width - marginRight}
                  y1={balanceY(v)}
                  y2={balanceY(v)}
                  stroke={Math.abs(v) < 0.001 ? COLOR.baseline : COLOR.grid}
                  strokeWidth={Math.abs(v) < 0.001 ? 1.25 : 1}
                  strokeDasharray={Math.abs(v) < 0.001 ? undefined : "2 4"}
                />
                <text x={marginLeft - 10} y={balanceY(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={COLOR.mutedInk}>
                  {rovid(v)}
                </text>
              </g>
            ))}

            <g className="cf-late">
              <path d={areaPath} fill={COLOR.bevetel} opacity={0.12} clipPath={`url(#${uid}-pos)`} />
              <path d={areaPath} fill={COLOR.kiadas} opacity={0.16} clipPath={`url(#${uid}-neg)`} />
            </g>
            <path className="cf-line" pathLength={1} d={linePath} fill="none" stroke={COLOR.zaro} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

            {hoverIdx !== null && (
              <line x1={linePoints[hoverIdx].x} x2={linePoints[hoverIdx].x} y1={0} y2={balanceHeight} stroke={COLOR.zaro} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            )}

            {linePoints.map((p, i) => {
              const aktiv = hoverIdx === i;
              const kicsi = n > 20;
              return (
                <circle
                  key={i}
                  className="cf-dot"
                  cx={p.x}
                  cy={p.y}
                  r={aktiv ? 6.5 : kicsi ? 3 : 4.5}
                  fill={p.negativ ? COLOR.zaroNegativ : COLOR.zaro}
                  stroke="var(--card)"
                  strokeWidth={2}
                  onMouseEnter={() => setHoverIdx(i)}
                  style={{ cursor: "pointer", animationDelay: `${200 + (i / Math.max(1, n - 1)) * 800}ms` }}
                />
              );
            })}

            {minPont.negativ ? (
              <text
                className="cf-late"
                x={Math.min(minPont.x, width - marginRight - 4)}
                y={minPont.y + (minPont.y > balanceHeight - 24 ? -12 : 20)}
                textAnchor={minPont.x > width - 120 ? "end" : "middle"}
                fontSize={11}
                fontWeight={600}
                fill={minPont.negativ ? COLOR.zaroNegativ : COLOR.mutedInk}
              >
                Mélypont {rovid(minPont.v)}
              </text>
            ) : null}

            {todayX !== null && (
              <g>
                <line x1={todayX} x2={todayX} y1={-gapBetween + 8} y2={balanceHeight} stroke={COLOR.today} strokeWidth={1.5} strokeDasharray="4 3" />
                <text x={todayX + 5} y={-gapBetween + 18} fontSize={10} fontWeight={600} fill={COLOR.today}>
                  ma
                </text>
              </g>
            )}
          </g>

          {/* --- X tengely: nap, és hónapnév váltáskor --- */}
          <g transform={`translate(0 ${flowHeight + gapBetween + balanceHeight + 16})`}>
            {bucketek.map((b, i) => {
              if (n > 16 && i % Math.ceil(n / 16) !== 0) return null;
              const cx = marginLeft + slot * i + slot / 2;
              const d = parseDate(b.kezdo_datum);
              const elozo = i > 0 ? parseDate(bucketek[i - 1].kezdo_datum) : null;
              const ujHonap = !elozo || elozo.getMonth() !== d.getMonth() || (n > 16 && i % Math.ceil(n / 16) === 0 && i === 0);
              const ujEv = !elozo || elozo.getFullYear() !== d.getFullYear();
              return (
                <g key={b.kezdo_datum}>
                  <text x={cx} y={0} textAnchor="middle" fontSize={11} fill={hoverIdx === i ? COLOR.ink : COLOR.mutedInk} fontWeight={hoverIdx === i ? 600 : 400}>
                    {havi ? HONAP[d.getMonth()] : d.getDate()}
                  </text>
                  {(havi ? ujEv : ujHonap) && (
                    <text x={cx} y={15} textAnchor="middle" fontSize={11} fontWeight={600} fill={COLOR.ink}>
                      {havi ? d.getFullYear() : `${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + " " : ""}${HONAP[d.getMonth()]}`}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {hovered && (
          <div
            className="cf-tip pointer-events-none absolute top-0 z-10 min-w-48 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-xs shadow-lg"
            style={{
              left: `${Math.min(86, Math.max(14, ((hoverIdx! + 0.5) / n) * 100))}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="mb-1.5 font-heading text-sm font-semibold">
              {hovered.kezdo_datum} – {hovered.vege_datum}
            </div>
            <Row label="Bevétel (tény)" value={huf(Number(hovered.bevetel_teny))} color={COLOR.bevetel} />
            <Row label="Bevétel (terv)" value={huf(Number(hovered.bevetel_terv))} color={COLOR.bevetel} dim />
            <Row label="Kiadás (tény)" value={huf(Number(hovered.kiadas_teny))} color={COLOR.kiadas} />
            <Row label="Kiadás (terv)" value={huf(Number(hovered.kiadas_terv))} color={COLOR.kiadas} dim />
            <div className="mt-1.5 flex justify-between gap-4 border-t border-[var(--border)] pt-1.5 text-sm font-semibold" style={{ color: hovered.negativ ? COLOR.zaroNegativ : COLOR.zaro }}>
              <span>Záró</span>
              <span>{huf(Number(hovered.zaro))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color, dim }: { label: string; value: string; color: string; dim?: boolean }) {
  return (
    <div className="flex justify-between gap-4" style={{ color, opacity: dim ? 0.85 : 1 }}>
      <span>{label}</span>
      <span className={dim ? "italic" : ""}>{value}</span>
    </div>
  );
}

function LegendSwatch({ fill, label, line, edge }: { fill: string; label: string; line?: boolean; edge?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width={line ? 16 : 12} height={12} aria-hidden="true">
        {line ? (
          <>
            <line x1={0} y1={6} x2={16} y2={6} stroke={fill} strokeWidth={2.5} />
            <circle cx={8} cy={6} r={3.5} fill={fill} />
          </>
        ) : (
          <rect x={0.5} y={0.5} width={11} height={11} rx={3} fill={fill} stroke={edge} strokeWidth={edge ? 1 : 0} />
        )}
      </svg>
      {label}
    </span>
  );
}
