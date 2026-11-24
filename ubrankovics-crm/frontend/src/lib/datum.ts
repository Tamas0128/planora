/** ÉÉÉÉ-HH-NN → "ÉÉÉÉ.HH.NN." (a felület egységes magyar dátumformátuma). */
export function huDatum(d?: string | null): string | null {
  return d ? d.replaceAll("-", ".") + "." : null;
}
