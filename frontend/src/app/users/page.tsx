"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { api, ROLE_LABELS, User } from "@/lib/api";
import { pmInitials } from "@/lib/project-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [string, string][];

function UserAvatarCell({ user, onUploaded }: { user: User; onUploaded: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user.has_avatar) {
      api.avatarUrl(user.id).then((r) => setUrl(r.url)).catch(() => setUrl(null));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset, no async step needed
      setUrl(null);
    }
  }, [user.id, user.has_avatar]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadAvatar(user.id, file);
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a feltöltés során");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        aria-label={`${user.full_name} profilkép feltöltése`}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Profilkép módosítása"
        aria-label="Profilkép módosítása"
        className="rounded-full disabled:opacity-50"
      >
        <Avatar size="sm">
          {url && <AvatarImage src={url} alt={user.full_name} />}
          <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
            {pmInitials(user.full_name)}
          </AvatarFallback>
        </Avatar>
      </button>
    </>
  );
}

export default function UsersPage() {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    role: "project_manager",
  });

  function load() {
    api.users().then(setUsers).catch(console.error);
  }

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createUser(form);
      setShowNew(false);
      setForm({ username: "", email: "", full_name: "", password: "", role: "project_manager" });
      load();
      toast.success("Felhasználó létrehozva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a létrehozás során");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(user: User) {
    if (user.id === me?.id) return;
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      load();
      toast.success(user.is_active ? "Felhasználó letiltva" : "Felhasználó aktiválva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  async function changeRole(user: User, role: string) {
    if (user.id === me?.id) return;
    try {
      await api.updateUser(user.id, { role });
      load();
      toast.success("Szerepkör módosítva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba a mentés során");
    }
  }

  if (me && me.role !== "admin") {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Nincs jogosultságod ehhez a felülethez.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-heading font-bold">Felhasználók</h1>
          <p className="text-xs text-muted-foreground">Felhasználói fiókok és szerepkörök kezelése</p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className=""
        >
          <Plus /> Új felhasználó
        </Button>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <form onSubmit={createUser}>
            <DialogHeader>
              <DialogTitle>Új felhasználó</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-username">Felhasználónév</Label>
                <Input
                  id="new-username"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-full-name">Teljes név</Label>
                <Input
                  id="new-full-name"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-email">E-mail</Label>
                <Input
                  id="new-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Jelszó</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Szerepkör</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as string })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => ROLE_OPTIONS.find(([val]) => val === v)?.[1] ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={creating}
                className=""
              >
                {creating ? "Mentés..." : "Létrehozás"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Felhasználónév</TableHead>
              <TableHead>Teljes név</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Szerepkör</TableHead>
              <TableHead>Állapot</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === me?.id;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <UserAvatarCell user={user} onUploaded={load} />
                  </TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {isSelf ? (
                      <span title="A saját szerepkörödet nem módosíthatod">
                        {ROLE_OPTIONS.find(([val]) => val === user.role)?.[1] ?? user.role}
                      </span>
                    ) : (
                      <Select value={user.role} onValueChange={(v) => changeRole(user, v as string)}>
                        <SelectTrigger size="sm">
                          <SelectValue>{(v: string) => ROLE_OPTIONS.find(([val]) => val === v)?.[1] ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <Badge className="bg-accent-100 text-accent-700">Aktív</Badge>
                    ) : (
                      <Badge variant="secondary">Inaktív</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground" title="Saját magadat nem tilthatod le">
                        Saját fiók
                      </span>
                    ) : (
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => {
                          if (!user.is_active || confirm(`Biztosan letiltod ${user.full_name} felhasználót?`)) {
                            toggleActive(user);
                          }
                        }}
                      >
                        {user.is_active ? "Letiltás" : "Aktiválás"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nincs felhasználó
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
