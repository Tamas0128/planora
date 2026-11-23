"use client";

import { FormEvent, useEffect, useState } from "react";
import { Calendar, Mail, MessageSquare, Phone, Trash2 } from "lucide-react";
import { api, Kommunikacio, KommunikacioTipus } from "@/lib/api";

const TIPUS: Record<KommunikacioTipus, { label: string; icon: typeof Phone }> = {
  hivas: { label: "Hívás", icon: Phone },
  email: { label: "E-mail", icon: Mail },
  talalkozo: { label: "Találkozó", icon: Calendar },
  megjegyzes: { label: "Megjegyzés", icon: MessageSquare },
};

export default function KommunikacioNaplo({ ugyfelId, erdeklodesId }: { ugyfelId?: number; erdeklodesId?: number }) {
  const [lista, setLista] = useState<Kommunikacio[]>([]);
  const [tipus, setTipus] = useState<KommunikacioTipus>("hivas");
  const [tartalom, setTartalom] = useState("");
  const [error, setError] = useState("");

  function load() {
    api
      .listKommunikacio({ ugyfel_id: ugyfelId, erdeklodes_id: erdeklodesId })
      .then(setLista)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ugyfelId, erdeklodesId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createKommunikacio({ ugyfel_id: ugyfelId, erdeklodes_id: erdeklodesId, tipus, tartalom });
      setTartalom("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function remove(id: number) {
    if (!confirm("Törlöd a bejegyzést?")) return;
    await api.deleteKommunikacio(id);
    load();
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Kommunikációs napló</h2>
      {error && <div className="mb-2 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      <form onSubmit={add} className="mb-3 flex gap-2">
        <select
          value={tipus}
          onChange={(e) => setTipus(e.target.value as KommunikacioTipus)}
          className="rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
          aria-label="Típus"
        >
          {Object.entries(TIPUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Mi történt?"
          value={tartalom}
          onChange={(e) => setTartalom(e.target.value)}
          className="flex-1 rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">
          Rögzít
        </button>
      </form>
      {lista.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Még nincs bejegyzés.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {lista.map((k) => {
            const { label, icon: Icon } = TIPUS[k.tipus];
            return (
              <li key={k.id} className="flex items-start gap-3 py-2 text-sm">
                <Icon size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" aria-label={label} />
                <div className="flex-1">
                  <div>{k.tartalom}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {label} · {new Date(k.datum).toLocaleString("hu-HU")}
                    {k.user ? ` · ${k.user.full_name}` : ""}
                  </div>
                </div>
                <button onClick={() => remove(k.id)} className="text-[var(--muted)] hover:text-[var(--danger)]" aria-label="Törlés">
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
