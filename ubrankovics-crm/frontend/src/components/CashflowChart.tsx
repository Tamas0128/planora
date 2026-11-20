"use client";

import { useMemo, useState } from "react";
import { CashflowBucket } from "@/lib/api";

const COLOR = {
  bevetelTeny: "#0ca30c",
  bevetelTerv: "#86d786",
  kiadasTeny: "#d03b3b",
  kiadasTerv: "#eca8a8",
  zaro: "#2a78d6",
  zaroNegativ: "#d03b3b",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  ink: "#52514e",
  mutedInk: "#898781",
};

function huf(v: number) {
  return `${Math.round(v).toLocaleString("hu-HU")} Ft`;
}

function niceStep(max: number): number {
  if (max <= 0) return 1;
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * pow;
}

export default function CashflowChart({ bucketek }: { bucketek: CashflowBucket[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 900;
  const marginLeft = 64;
  const marginRight = 16;
  const flowHeight = 170;
  const balanceHeight = 110;
  const gapBetween = 28;
  const bottomAxisHeight = 24;
  const plotWidth = width - marginLeft - marginRight;

  const n = bucketek.length;
  const slot = n > 0 ? plotWidth / n : plotWidth;
  const barWidth = Math.min(24, slot * 0.6);

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

  if (n === 0) return null;

  const flowY = (v: number) => flowHeight / 2 - (v / flow.axisMax) * (flowHeight / 2 - 4);
  const balanceRange = balance.axisMax - balance.axisMin || 1;
  const balanceY = (v: number) => balanceHeight - ((v - balance.axisMin) / balanceRange) * balanceHeight;

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

  const hovered = hoverIdx !== null ? bucketek[hoverIdx] : null;

  return (
    <div className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4`}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        <LegendSwatch color={COLOR.bevetelTeny} label="Bevétel (tényleges)" />
        <LegendSwatch color={COLOR.bevetelTerv} label="Bevétel (tervezett)" />
        <LegendSwatch color={COLOR.kiadasTeny} label="Kiadás (tényleges)" />
        <LegendSwatch color={COLOR.kiadasTerv} label="Kiadás (tervezett)" />
        <LegendSwatch color={COLOR.zaro} label="Záró egyenleg" line />
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${flowHeight + gapBetween + balanceHeight + bottomAxisHeight}`}
          className="w-full"
          role="img"
          aria-label="Gördülő cash-flow diagram: bevétel/kiadás buckettenként és a göngyölített záró egyenleg"
        >
          {/* --- Flow (bevétel/kiadás) chart --- */}
          <g>
            {flowGridLines.map((v) => (
              <g key={v}>
                <line
                  x1={marginLeft}
                  x2={width - marginRight}
                  y1={flowY(v)}
                  y2={flowY(v)}
                  stroke={v === 0 ? COLOR.baseline : COLOR.grid}
                  strokeWidth={1}
                />
                <text x={marginLeft - 8} y={flowY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={COLOR.mutedInk}>
                  {v === 0 ? "0" : `${Math.round(v / 1000).toLocaleString("hu-HU")}e`}
                </text>
              </g>
            ))}
            {bucketek.map((b, i) => {
              const cx = marginLeft + slot * i + slot / 2;
              const bevTeny = Number(b.bevetel_teny);
              const bevTerv = Number(b.bevetel_terv);
              const kiaTeny = Number(b.kiadas_teny);
              const kiaTerv = Number(b.kiadas_terv);
              const zero = flowY(0);
              return (
                <g
                  key={b.kezdo_datum}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
                  style={{ cursor: "pointer" }}
                >
                  <rect x={cx - barWidth / 2} y={0} width={barWidth} height={flowHeight} fill="transparent" />
                  {bevTeny > 0 && (
                    <rect x={cx - barWidth / 2} y={flowY(bevTeny)} width={barWidth} height={zero - flowY(bevTeny)} rx={3} fill={COLOR.bevetelTeny} />
                  )}
                  {bevTerv > 0 && (
                    <rect
                      x={cx - barWidth / 2}
                      y={flowY(bevTeny + bevTerv) - (bevTeny > 0 ? 2 : 0)}
                      width={barWidth}
                      height={flowY(bevTeny) - flowY(bevTeny + bevTerv) - (bevTeny > 0 ? 2 : 0)}
                      rx={3}
                      fill={COLOR.bevetelTerv}
                    />
                  )}
                  {kiaTeny > 0 && (
                    <rect x={cx - barWidth / 2} y={zero} width={barWidth} height={flowY(-kiaTeny) - zero} rx={3} fill={COLOR.kiadasTeny} />
                  )}
                  {kiaTerv > 0 && (
                    <rect
                      x={cx - barWidth / 2}
                      y={flowY(-kiaTeny) + (kiaTeny > 0 ? 2 : 0)}
                      width={barWidth}
                      height={flowY(-kiaTeny - kiaTerv) - flowY(-kiaTeny) - (kiaTeny > 0 ? 2 : 0)}
                      rx={3}
                      fill={COLOR.kiadasTerv}
                    />
                  )}
                  {hoverIdx === i && (
                    <rect x={marginLeft + slot * i} y={0} width={slot} height={flowHeight} fill="#000" opacity={0.03} />
                  )}
                </g>
              );
            })}
          </g>

          {/* --- Záró egyenleg (closing balance) line chart --- */}
          <g transform={`translate(0 ${flowHeight + gapBetween})`}>
            {balanceGridValues.map((v) => (
              <g key={v}>
                <line
                  x1={marginLeft}
                  x2={width - marginRight}
                  y1={balanceY(v)}
                  y2={balanceY(v)}
                  stroke={v === 0 ? COLOR.baseline : COLOR.grid}
                  strokeWidth={1}
                />
                <text x={marginLeft - 8} y={balanceY(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={COLOR.mutedInk}>
                  {Math.round(v / 1000).toLocaleString("hu-HU")}e
                </text>
              </g>
            ))}
            <path d={linePath} fill="none" stroke={COLOR.zaro} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {linePoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={5}
                fill={p.negativ ? COLOR.zaroNegativ : COLOR.zaro}
                stroke="var(--card)"
                strokeWidth={2}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
                style={{ cursor: "pointer" }}
              />
            ))}
            {linePoints.length > 0 && (
              <text
                x={linePoints[linePoints.length - 1].x}
                y={linePoints[linePoints.length - 1].y - 10}
                textAnchor="end"
                fontSize={11}
                fontWeight={600}
                fill={linePoints[linePoints.length - 1].negativ ? COLOR.zaroNegativ : COLOR.ink}
              >
                {huf(linePoints[linePoints.length - 1].v)}
              </text>
            )}
          </g>

          {/* --- Shared x-axis labels (periods), under the balance chart --- */}
          <g transform={`translate(0 ${flowHeight + gapBetween + balanceHeight + 14})`}>
            {bucketek.map((b, i) => {
              if (n > 16 && i % Math.ceil(n / 16) !== 0) return null;
              const cx = marginLeft + slot * i + slot / 2;
              return (
                <text key={b.kezdo_datum} x={cx} y={0} textAnchor="middle" fontSize={9} fill={COLOR.mutedInk}>
                  {b.kezdo_datum.slice(5)}
                </text>
              );
            })}
          </g>
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${Math.min(92, Math.max(8, ((hoverIdx! + 0.5) / n) * 100))}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="mb-1 font-semibold">
              {hovered.kezdo_datum} – {hovered.vege_datum}
            </div>
            <div style={{ color: COLOR.bevetelTeny }}>Bevétel (tény): {huf(Number(hovered.bevetel_teny))}</div>
            <div style={{ color: COLOR.bevetelTerv }}>Bevétel (terv): {huf(Number(hovered.bevetel_terv))}</div>
            <div style={{ color: COLOR.kiadasTeny }}>Kiadás (tény): {huf(Number(hovered.kiadas_teny))}</div>
            <div style={{ color: COLOR.kiadasTerv }}>Kiadás (terv): {huf(Number(hovered.kiadas_terv))}</div>
            <div className="mt-1 font-semibold" style={{ color: hovered.negativ ? COLOR.zaroNegativ : COLOR.zaro }}>
              Záró: {huf(Number(hovered.zaro))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {line ? (
        <svg width={14} height={10} aria-hidden="true">
          <line x1={0} y1={5} x2={14} y2={5} stroke={color} strokeWidth={2} />
          <circle cx={7} cy={5} r={3} fill={color} />
        </svg>
      ) : (
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}
