"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** A QR-kód SVG-ként készül a böngészőben, a titkos kulcs nem hagyja el az oldalt. */
export default function QrKod({ ertek, felirat }: { ertek: string; felirat: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(ertek);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [ertek]);
  return (
    <div
      role="img"
      aria-label={felirat}
      className="h-44 w-44 rounded-[var(--radius)] border border-[var(--border)] bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
