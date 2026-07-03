"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { api, User } from "@/lib/api";
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

const ROLE_OPTIONS: [string, string][] = [
  ["admin", "Admin"],
  ["project_manager", "Projektmenedzser"],
  ["management", "Menedzsment"],
  ["procurement", "Beszerzés"],
  ["billing", "Számlázás"],
];

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
    await api.updateUser(user.id, { is_active: !user.is_active });
    load();
  }

  async function changeRole(user: User, role: string) {
    await api.updateUser(user.id, { role });
    load();
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
          <h1 className="text-lg font-bold">Felhasználók</h1>
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
              <TableHead>Felhasználónév</TableHead>
              <TableHead>Teljes név</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Szerepkör</TableHead>
              <TableHead>Állapot</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  {user.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700">Aktív</Badge>
                  ) : (
                    <Badge variant="secondary">Inaktív</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="link" className="h-auto p-0" onClick={() => toggleActive(user)}>
                    {user.is_active ? "Letiltás" : "Aktiválás"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
