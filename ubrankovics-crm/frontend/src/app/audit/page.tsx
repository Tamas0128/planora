"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, AuditNaploItem } from "@/lib/api";

const ENTITAS_CIMKE: Record<string, string> = {
  ugyfel: "Ügyfél", erdeklodes: "Érdeklődő", jegy: "Jegy", kampany: "Kampány", cimke: "Címke", egyedi_mezo: "Egyedi mező", cel: "Értékesítési cél",
  projekt: "Projekt", ajanlat: "Ajánlat", atvetel: "Átadás", naplo: "Napló", sablon: "Dokumentumsablon", user: "Felhasználó",
};
const MUVELET_CIMKE: Record<string, string> = {
  letrehozas: "Létrehozás", modositas: "Módosítás", torles: "Törlés", allapot: "Állapotváltás", import: "Import", excel_import: "Excel-átvétel",
  atemeles: "Átemelés a tételekbe", uj_verzio: "Új verzió", alairas: "Aláírás", kuldes: "Küldés", feltoltes: "Feltöltés", foto: "Fotó", foto_torles: "Fotó törlése",
  konverzio: "Átalakítás ügyféllé", egyesites: "Összevonás", leiratkozas: "Leiratkozás", beallitas: "Beállítás", cimkek: "Címkék módosítása",
  dokumentum_generalas: "Dokumentum generálása", egyedi_mezo_ertek: "Egyedi mező értéke", jelszo_visszaallitva: "Jelszó visszaállítva",
  jelszo_visszaallitas_kerve: "Jelszó-visszaállítás kérve", "2fa_bekapcsolva": "Kétlépcsős belépés bekapcsolva", "2fa_kikapcsolva": "Kétlépcsős belépés kikapcsolva",
  "2fa_admin_visszaallitas": "Kétlépcsős belépés visszaállítva (admin)",
};
const ENTITASOK = ["", ...Object.keys(ENTITAS_CIMKE)];

export default function AuditPage() {
  const [lista, setLista] = useState<AuditNaploItem[]>([]);
  const [entitas, setEntitas] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.listAudit(entitas || undefined).then(setLista).catch((e) => setError(e.message));
  }, [entitas]);

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Auditnapló</h1>
        <select
          value={entitas}
          onChange={(e) => setEntitas(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          aria-label="Típus szűrő"
        >
          {ENTITASOK.map((e) => (
            <option key={e} value={e}>
              {e ? ENTITAS_CIMKE[e] : "Minden típus"}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      <div tabIndex={0} className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="px-3 py-2">Időpont</th>
              <th className="px-3 py-2">Felhasználó</th>
              <th className="px-3 py-2">Mire vonatkozik</th>
              <th className="px-3 py-2">Művelet</th>
              <th className="px-3 py-2">Részletek</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((n) => (
              <tr key={n.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(n.created_at).toLocaleString("hu-HU")}</td>
                <td className="px-3 py-2">{n.user?.full_name || "—"}</td>
                <td className="px-3 py-2">
                  {ENTITAS_CIMKE[n.entitas] ?? n.entitas}
                  {n.entitas_id != null ? ` #${n.entitas_id}` : ""}
                </td>
                <td className="px-3 py-2">{MUVELET_CIMKE[n.muvelet] ?? n.muvelet}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{n.reszletek || ""}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                  Nincs bejegyzés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
