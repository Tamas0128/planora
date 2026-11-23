"use client";

import { FormEvent, useState } from "react";
import { Upload } from "lucide-react";
import Modal from "./Modal";
import { BankkivonatJavaslat, BankkivonatSor, api } from "@/lib/api";

const inputCls = "rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";
const btnCls =
  "flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm text-[var(--primary-foreground)] disabled:opacity-60";

function huf(v: string) {
  return `${Number(v).toLocaleString("hu-HU")} Ft`;
}

export default function BankkivonatImport({ onApplied }: { onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sorok, setSorok] = useState<BankkivonatSor[] | null>(null);
  const [kivalasztva, setKivalasztva] = useState<Record<number, boolean>>({});
  const [valasztottAlternativa, setValasztottAlternativa] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setSorok(null);
    setKivalasztva({});
    setValasztottAlternativa({});
    setError("");
    setSummary(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function handleElemzes(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.elemezBankkivonat(file);
      setSorok(res.sorok);
      const initial: Record<number, boolean> = {};
      res.sorok.forEach((s, i) => {
        initial[i] = !!s.javaslat;
      });
      setKivalasztva(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba az elemzés során");
    } finally {
      setLoading(false);
    }
  }

  function getMatch(sor: BankkivonatSor, idx: number): BankkivonatJavaslat | null {
    if (sor.javaslat) return sor.javaslat;
    const chosen = valasztottAlternativa[idx];
    if (chosen !== undefined && sor.alternativak[chosen]) return sor.alternativak[chosen];
    return null;
  }

  async function handleJovahagyas() {
    if (!file || !sorok) return;
    const tetelek = sorok
      .map((s, i) => ({ s, i, match: getMatch(s, i) }))
      .filter(({ i, match }) => kivalasztva[i] && match)
      .map(({ s, match }) => ({
        forras_tipus: match!.forras_tipus,
        forras_id: match!.forras_id,
        datum: s.datum,
        osszeg: s.osszeg,
      }));
    if (tetelek.length === 0) {
      setError("Nincs kijelölt, egyeztetett tétel a jóváhagyáshoz.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.jovahagyBankkivonat(file, tetelek);
      setSummary(
        `${res.feldolgozott_szama} tétel feldolgozva, ${res.erintett_projektek.length} projekt érintve (a bankkivonat csatolva lett dokumentumként).`
      );
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba a jóváhagyás során");
    } finally {
      setLoading(false);
    }
  }

  const egyeztetettSzam = sorok?.filter((s) => s.javaslat).length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm"
      >
        <Upload size={14} /> Bankkivonat feltöltése (xlsx)
      </button>

      {open && (
        <Modal title="Bankkivonat import" onClose={close} wide>
          {summary ? (
            <div className="space-y-3">
              <p className="text-sm">{summary}</p>
              <div className="flex justify-end">
                <button type="button" onClick={close} className={btnCls}>
                  Bezárás
                </button>
              </div>
            </div>
          ) : !sorok ? (
            <form onSubmit={handleElemzes} className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Bankkivonat (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                  required
                />
              </div>
              <p className="text-xs text-[var(--muted)]">
                Várt oszlopok: dátum (pl. „Könyvelés dátuma”), összeg (vagy külön „Jóváírás”/„Terhelés”), és egy
                közlemény/partnernév oszlop, amiben a számlaszám vagy a partner neve szerepel — ez alapján azonosítjuk
                automatikusan a projektet és a nyitott számlát. A tényleges fizetés rögzítése csak a következő
                lépésben, kézi jóváhagyás után történik.
              </p>
              {error && <div className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={close} className="rounded-[var(--radius)] px-3 py-1.5 text-sm text-[var(--muted)]">
                  Mégse
                </button>
                <button type="submit" disabled={!file || loading} className={btnCls}>
                  {loading ? "Elemzés..." : "Elemzés"}
                </button>
              </div>
            </form>
          ) : (
            <div>
              <p className="mb-3 text-sm text-[var(--muted)]">
                {sorok.length} sor beolvasva, ebből {egyeztetettSzam} automatikusan egyeztetve. Jelöld ki (vagy
                válassz manuálisan), melyeket hagyod jóvá — ez rögzíti a fizetést és csatolja a kivonatot az érintett
                projekt(ek)hez.
              </p>
              <div className="max-h-96 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-[var(--border)] bg-[var(--card)] text-left text-xs text-[var(--muted)]">
                    <tr>
                      <th className="px-2 py-2"></th>
                      <th className="px-2 py-2">Dátum</th>
                      <th className="px-2 py-2 text-right">Összeg</th>
                      <th className="px-2 py-2">Közlemény</th>
                      <th className="px-2 py-2">Egyeztetés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorok.map((s, i) => {
                      const match = getMatch(s, i);
                      return (
                        <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={!!kivalasztva[i] && !!match}
                              disabled={!match}
                              onChange={(e) => setKivalasztva({ ...kivalasztva, [i]: e.target.checked })}
                            />
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5">{s.datum}</td>
                          <td className={`whitespace-nowrap px-2 py-1.5 text-right ${s.irany === "bevetel" ? "text-[var(--positive)]" : "text-[var(--danger)]"}`}>
                            {huf(s.osszeg)}
                          </td>
                          <td className="max-w-[16rem] truncate px-2 py-1.5" title={s.kozlemeny}>
                            {s.kozlemeny}
                          </td>
                          <td className="px-2 py-1.5">
                            {match ? (
                              <span>
                                {match.projekt_nev} — {match.partner_nev} ({match.szamlaszam})
                                {!match.biztos && <span className="text-[var(--muted)]"> · névegyezés</span>}
                              </span>
                            ) : s.alternativak.length > 0 ? (
                              <select
                                className={`${inputCls} py-1`}
                                defaultValue=""
                                onChange={(e) => {
                                  const idx = e.target.value === "" ? undefined : Number(e.target.value);
                                  setValasztottAlternativa((prev) => {
                                    const next = { ...prev };
                                    if (idx === undefined) delete next[i];
                                    else next[i] = idx;
                                    return next;
                                  });
                                  setKivalasztva((prev) => ({ ...prev, [i]: idx !== undefined }));
                                }}
                              >
                                <option value="">Válassz a lehetséges egyezések közül…</option>
                                {s.alternativak.map((a, ai) => (
                                  <option key={ai} value={ai}>
                                    {a.projekt_nev} — {a.partner_nev} ({a.szamlaszam})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[var(--muted)]">Nincs egyezés — kihagyva</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {error && (
                <div className="mt-3 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={close} className="rounded-[var(--radius)] px-3 py-1.5 text-sm text-[var(--muted)]">
                  Mégse
                </button>
                <button type="button" onClick={handleJovahagyas} disabled={loading} className={btnCls}>
                  {loading ? "Jóváhagyás..." : "Jóváhagyás"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
