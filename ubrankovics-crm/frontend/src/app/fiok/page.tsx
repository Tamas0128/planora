"use client";

import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import QrKod from "@/components/QrKod";
import { api, UserResponse } from "@/lib/api";

const INPUT = "w-full rounded-[var(--radius)] border border-[var(--border)] px-2 py-1.5 text-sm";

export default function FiokPage() {
  const [me, setMe] = useState<UserResponse | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [jelszo, setJelszo] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    api.me().then(setMe).catch((e) => setError(e.message));
  }, []);

  async function run(fn: () => Promise<void>) {
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba");
    }
  }

  const indit = () => run(async () => setSetup(await api.tfaBeallitas()));
  const bekapcsol = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.tfaBekapcsolas(code);
      setSetup(null);
      setCode("");
      setMe(await api.me());
      setInfo("A kétlépcsős belépés bekapcsolva.");
    });
  };
  const kikapcsol = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.tfaKikapcsolas(jelszo, code);
      setCode("");
      setJelszo("");
      setMe(await api.me());
      setInfo("A kétlépcsős belépés kikapcsolva.");
    });
  };

  return (
    <AppLayout>
      <h1 className="mb-4 text-xl font-semibold">Fiókom</h1>
      {me && (
        <p className="mb-4 text-sm text-[var(--muted)]">
          {me.full_name} · {me.username} · {me.email}
        </p>
      )}
      {error && <div role="alert" className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
      {info && <div role="status" className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">{info}</div>}

      <section className="max-w-lg space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4" aria-labelledby="tfa-cim">
        <h2 id="tfa-cim" className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={16} /> Kétlépcsős belépés (hitelesítő alkalmazás)
        </h2>
        {me?.totp_enabled ? (
          <form onSubmit={kikapcsol} className="space-y-3">
            <p className="text-sm">Be van kapcsolva. A kikapcsoláshoz add meg a jelszavad és az aktuális kódot.</p>
            <div className="space-y-1">
              <label htmlFor="tfa-jelszo" className="text-sm font-medium">Jelszó</label>
              <input id="tfa-jelszo" type="password" required autoComplete="current-password" className={INPUT} value={jelszo} onChange={(e) => setJelszo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="tfa-kod" className="text-sm font-medium">Hitelesítő kód</label>
              <input id="tfa-kod" required inputMode="numeric" maxLength={6} autoComplete="one-time-code" className={INPUT} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <button className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--danger)]">Kikapcsolás</button>
          </form>
        ) : setup ? (
          <form onSubmit={bekapcsol} className="space-y-3">
            <p className="text-sm">
              Olvasd be a QR-kódot a hitelesítő alkalmazással (pl. Google Authenticator, Aegis), majd írd be a megjelenő 6 jegyű kódot. A kétlépcsős belépés opcionális, bármikor kikapcsolhatod.
            </p>
            <QrKod ertek={setup.otpauth_uri} felirat="QR-kód a hitelesítő alkalmazás beállításához" />
            <div className="space-y-1">
              <label htmlFor="tfa-kulcs" className="text-sm font-medium">Ha nem tudod beolvasni: titkos kulcs kézi megadáshoz</label>
              <input id="tfa-kulcs" readOnly className={`${INPUT} font-mono`} value={setup.secret} onFocus={(e) => e.currentTarget.select()} data-testid="tfa-kulcs" />
            </div>
            <div className="space-y-1">
              <label htmlFor="tfa-kod" className="text-sm font-medium">Hitelesítő kód</label>
              <input id="tfa-kod" required inputMode="numeric" maxLength={6} autoComplete="one-time-code" className={INPUT} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <button className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">Bekapcsolás</button>
          </form>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">Belépéskor a jelszó mellett egy telefonos alkalmazás által generált kódot is kérünk.</p>
            <button onClick={indit} className="rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">Beállítás indítása</button>
          </>
        )}
      </section>
    </AppLayout>
  );
}
