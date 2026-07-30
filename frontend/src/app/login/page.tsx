"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, setTokens } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [pilotMode, setPilotMode] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .pilotStatus()
      .then((res) => setPilotMode(res.pilot_mode))
      .catch(() => setPilotMode(false));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-900 via-accent-900 to-neutral-900 p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="items-center pb-2 text-center">
          <Image
            src="/planora-logo.png"
            alt="PLANora Projekt"
            width={288}
            height={96}
            priority
            className="mb-2"
          />
        </CardHeader>
        <CardContent>
          {pilotMode === null ? null : pilotMode ? (
            <PilotLogin router={router} />
          ) : (
            <CredentialsLogin router={router} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PilotLogin({ router }: { router: ReturnType<typeof useRouter> }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEnter() {
    setLoading(true);
    setError("");
    try {
      const res = await api.pilotLogin();
      setTokens(res.access_token, res.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Belépés sikertelen");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-lg font-medium text-foreground">Üdvözöljük a PLANorában!</p>
      {error && (
        <div className="bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20">
          {error}
        </div>
      )}
      <Button onClick={handleEnter} disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin" />}
        {loading ? "Belépés..." : "Belépés"}
      </Button>
    </div>
  );
}

function CredentialsLogin({ router }: { router: ReturnType<typeof useRouter> }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password);
      setTokens(res.access_token, res.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bejelentkezés sikertelen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20">
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="username">Felhasználónév</Label>
        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Jelszó</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin" />}
        {loading ? "Bejelentkezés..." : "Bejelentkezés"}
      </Button>
    </form>
  );
}
