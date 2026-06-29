"use client";

import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { api, AuditLogEntry, ProjectCard, User } from "@/lib/api";
import { Card } from "@/components/ui/card";
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

export default function AuditLogPage() {
  const [me, setMe] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [projectId, setProjectId] = useState<string>("all");

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    api.projects().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    api
      .auditLogs(projectId !== "all" ? Number(projectId) : undefined)
      .then(setLogs)
      .catch(console.error);
  }, [projectId]);

  if (me && me.role !== "admin" && me.role !== "management") {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Nincs jogosultságod ehhez a felülethez.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit napló</h1>
          <p className="text-muted-foreground">Módosítások nyomon követése</p>
        </div>
        <Select value={projectId} onValueChange={(v) => setProjectId(v as string)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes projekt</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Időpont</TableHead>
              <TableHead>Felhasználó</TableHead>
              <TableHead>Projekt</TableHead>
              <TableHead>Entitás</TableHead>
              <TableHead>Mező</TableHead>
              <TableHead>Régi érték</TableHead>
              <TableHead>Új érték</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("hu-HU")}
                </TableCell>
                <TableCell>{log.user_name || `#${log.user_id}`}</TableCell>
                <TableCell>{log.project_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{log.entity_type}</TableCell>
                <TableCell className="font-medium">{log.field_name}</TableCell>
                <TableCell className="text-muted-foreground">{log.old_value || "—"}</TableCell>
                <TableCell>{log.new_value || "—"}</TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nincs naplóbejegyzés
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}
