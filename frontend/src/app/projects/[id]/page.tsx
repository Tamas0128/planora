"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Activity,
  api,
  BUILDING_LABELS,
  ProjectDetail,
  ProjectDocument,
  ROLE_LABELS,
  STATUS_LABELS,
  User,
} from "@/lib/api";

const BUILDING_OPTIONS: [string, string][] = [
  ["light_steel", "Könnyűszerkezetes"],
  ["clt", "CLT"],
  ["timber_frame", "Gerendaház"],
  ["other", "Egyéb"],
];

const STATUS_OPTIONS: [string, string][] = [
  ["planning", "Tervezés alatt"],
  ["foundation", "Alapozás"],
  ["structure", "Szerkezetállítás"],
  ["exterior_done", "Kívülről kész"],
  ["turnkey", "Kulcsrakész"],
];

const ASSIGNMENT_FIELDS: [string, string][] = [
  ["project_manager_id", "Projektmenedzser"],
  ["site_manager_id", "Építésvezető"],
  ["procurement_id", "Beszerzés"],
  ["billing_id", "Számlázás"],
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [tab, setTab] = useState<"info" | "schedule" | "documents">("info");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function loadProject() {
    api.project(id).then(setProject).catch(console.error);
  }
  function loadActivities() {
    api.activities(id).then(setActivities).catch(console.error);
  }
  function loadDocuments() {
    api.documents(id).then(setDocuments).catch(console.error);
  }

  useEffect(() => {
    if (!id) return;
    loadProject();
    loadActivities();
    loadDocuments();
    api.me().then(setMe).catch(() => setMe(null));
    api.users().then(setUsers).catch(() => setUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canEdit = me?.role === "admin" || me?.role === "management" || me?.role === "project_manager";

  async function updateStatus(activityId: number, status: string) {
    await api.updateActivity(id, activityId, { status });
    loadActivities();
    loadProject();
  }

  function startEdit() {
    if (!project) return;
    setForm({
      name: project.name,
      settlement: project.settlement,
      address: project.address,
      lot_number: project.lot_number || "",
      client_name: project.client_name,
      client_phone: project.client_phone || "",
      client_email: project.client_email || "",
      building_type: project.building_type,
      floor_area_sqm: project.floor_area_sqm,
      delivery_date: project.delivery_date,
      status: project.status,
      project_manager_id: project.project_manager_id ?? "",
      site_manager_id: project.site_manager_id ?? "",
      procurement_id: project.procurement_id ?? "",
      billing_id: project.billing_id ?? "",
      subcontractors: project.subcontractors || "",
    });
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      for (const [key] of ASSIGNMENT_FIELDS) {
        payload[key] = payload[key] ? Number(payload[key]) : null;
      }
      payload.floor_area_sqm = Number(payload.floor_area_sqm);
      for (const key of ["lot_number", "client_phone", "client_email", "subcontractors"]) {
        if (payload[key] === "") payload[key] = null;
      }
      await api.updateProject(id, payload);
      setEditing(false);
      loadProject();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hiba a mentés során");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadDocument(id, file);
      loadDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feltöltés sikertelen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDownload(documentId: number) {
    // Open the tab synchronously, inside the click handler, so browsers still
    // treat it as a direct result of user interaction. Navigating it only
    // after the presigned-URL fetch resolves (the old approach) crosses an
    // await boundary and popup blockers may silently swallow window.open then.
    const tab = window.open("", "_blank");
    if (!tab) {
      alert("A böngésző blokkolta a felugró ablakot. Engedélyezd a felugró ablakokat ehhez az oldalhoz, majd próbáld újra.");
      return;
    }
    try {
      const { url } = await api.downloadDocument(id, documentId);
      tab.location.href = url;
    } catch (err) {
      tab.close();
      alert(err instanceof Error ? err.message : "Hiba a letöltés során");
    }
  }

  async function handleDeleteDocument(documentId: number) {
    if (!confirm("Biztosan törlöd ezt a dokumentumot?")) return;
    await api.deleteDocument(id, documentId);
    loadDocuments();
  }

  async function addPrerequisite(activityId: number, prerequisiteId: number) {
    try {
      await api.addDependency(id, activityId, prerequisiteId);
      loadActivities();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hiba");
    }
  }

  async function removePrerequisite(activityId: number, prerequisiteId: number) {
    await api.removeDependency(id, activityId, prerequisiteId);
    loadActivities();
  }

  function updateLocalActivity(activityId: number, patch: Partial<Activity>) {
    setActivities((prev) => prev.map((a) => (a.id === activityId ? { ...a, ...patch } : a)));
  }

  async function commitActivityField(activityId: number, field: "duration_days" | "prep_days", value: number) {
    if (!value || value < 1 || !Number.isFinite(value)) {
      alert("A megadott értéknek legalább 1 napnak kell lennie.");
      loadActivities();
      return;
    }
    try {
      await api.updateActivity(id, activityId, { [field]: value });
      loadActivities();
      loadProject();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hiba a mentés során");
      loadActivities();
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    if (!confirm(`Biztosan törlöd a "${project.name}" projektet? Ez minden tevékenységét és dokumentumát is törli.`)) {
      return;
    }
    try {
      await api.deleteProject(id);
      router.push("/projects");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Hiba a törlés során");
    }
  }

  if (!project) {
    return (
      <AppLayout>
        <p className="text-gray-500">Betöltés...</p>
      </AppLayout>
    );
  }

  const activityNameById: Record<number, string> = {};
  for (const a of activities) activityNameById[a.id] = a.name;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-gray-500">
          {project.project_code} · {project.settlement}
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(["info", "schedule", "documents"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-indigo-600 text-white" : "bg-white text-gray-600 shadow-sm"
            }`}
          >
            {t === "info" ? "Adatlap" : t === "schedule" ? "Ütemterv" : "Dokumentumok"}
          </button>
        ))}
      </div>

      {tab === "info" && !editing && (
        <div>
          {canEdit && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={startEdit}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600"
              >
                Szerkesztés
              </button>
              <button
                onClick={handleDeleteProject}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Törlés
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold">Projekt adatok</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Státusz</dt><dd>{STATUS_LABELS[project.status]}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Cím</dt><dd>{project.address}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Helyrajzi szám</dt><dd>{project.lot_number || "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Épülettípus</dt><dd>{BUILDING_LABELS[project.building_type]}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Alapterület</dt><dd>{project.floor_area_sqm} m²</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Átadás</dt><dd>{new Date(project.delivery_date).toLocaleDateString("hu-HU")}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Készültség</dt><dd>{project.completion_percent}%</dd></div>
              </dl>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold">Ügyfél</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Név</dt><dd>{project.client_name}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Telefon</dt><dd>{project.client_phone || "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">E-mail</dt><dd>{project.client_email || "—"}</dd></div>
              </dl>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm md:col-span-2">
              <h3 className="mb-3 font-semibold">Résztvevők</h3>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-gray-500">Projektmenedzser</dt><dd>{project.project_manager_name || "—"}</dd></div>
                <div><dt className="text-gray-500">Építésvezető</dt><dd>{project.site_manager_name || "—"}</dd></div>
                <div><dt className="text-gray-500">Beszerzés</dt><dd>{project.procurement_name || "—"}</dd></div>
                <div><dt className="text-gray-500">Számlázás</dt><dd>{project.billing_name || "—"}</dd></div>
              </dl>
              {project.subcontractors && (
                <div className="mt-3 text-sm">
                  <dt className="text-gray-500">Alvállalkozók</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{project.subcontractors}</dd>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "info" && editing && (
        <form onSubmit={saveEdit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-gray-600">Projekt neve</span>
              <input
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.name as string}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Település</span>
              <input
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.settlement as string}
                onChange={(e) => setForm({ ...form, settlement: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Cím</span>
              <input
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.address as string}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Helyrajzi szám</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.lot_number as string}
                onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Ügyfél neve</span>
              <input
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.client_name as string}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Ügyfél telefon</span>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.client_phone as string}
                onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Ügyfél e-mail</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.client_email as string}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Épülettípus</span>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.building_type as string}
                onChange={(e) => setForm({ ...form, building_type: e.target.value })}
              >
                {BUILDING_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Alapterület (m²)</span>
              <input
                type="number"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.floor_area_sqm as number}
                onChange={(e) => setForm({ ...form, floor_area_sqm: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Átadási határidő</span>
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.delivery_date as string}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Státusz</span>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.status as string}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-3 font-semibold">Résztvevők</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ASSIGNMENT_FIELDS.map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-sm text-gray-600">{label}</span>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={form[key] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  >
                    <option value="">—</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({ROLE_LABELS[u.role] || u.role})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-sm text-gray-600">Alvállalkozók</span>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.subcontractors as string}
                onChange={(e) => setForm({ ...form, subcontractors: e.target.value })}
              />
            </label>
          </div>

          <div className="flex gap-2 border-t pt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Mentés..." : "Mentés"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border px-4 py-2"
            >
              Mégse
            </button>
          </div>
        </form>
      )}

      {tab === "schedule" && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Tevékenység</th>
                <th className="px-4 py-3">Futási idő (nap)</th>
                <th className="px-4 py-3">Előkészítési idő (nap)</th>
                <th className="px-4 py-3">Előkészítés dátuma</th>
                <th className="px-4 py-3">Kezdés</th>
                <th className="px-4 py-3">Befejezés</th>
                <th className="px-4 py-3">Előfeltételek</th>
                <th className="px-4 py-3">Státusz</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={a.duration_days}
                      disabled={!canEdit}
                      onChange={(e) => updateLocalActivity(a.id, { duration_days: Number(e.target.value) })}
                      onBlur={(e) => commitActivityField(a.id, "duration_days", Number(e.target.value))}
                      className="w-16 rounded border px-2 py-1 text-xs disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={a.prep_days}
                      disabled={!canEdit}
                      onChange={(e) => updateLocalActivity(a.id, { prep_days: Number(e.target.value) })}
                      onBlur={(e) => commitActivityField(a.id, "prep_days", Number(e.target.value))}
                      className="w-16 rounded border px-2 py-1 text-xs disabled:bg-gray-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {a.prep_date ? new Date(a.prep_date).toLocaleDateString("hu-HU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.start_date ? new Date(a.start_date).toLocaleDateString("hu-HU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.end_date ? new Date(a.end_date).toLocaleDateString("hu-HU") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {a.prerequisite_ids.map((pid) => (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                        >
                          {activityNameById[pid] || `#${pid}`}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => removePrerequisite(a.id, pid)}
                              className="text-gray-400 hover:text-red-500"
                              title="Eltávolítás"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {canEdit && (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val) addPrerequisite(a.id, val);
                          }}
                          className="rounded border px-1 py-0.5 text-xs text-gray-500"
                        >
                          <option value="">+ előfeltétel</option>
                          {activities
                            .filter((other) => other.id !== a.id && !a.prerequisite_ids.includes(other.id))
                            .map((other) => (
                              <option key={other.id} value={other.id}>
                                {other.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={a.status}
                      onChange={(e) => updateStatus(a.id, e.target.value)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      <option value="pending">Várakozik</option>
                      <option value="in_progress">Folyamatban</option>
                      <option value="done">Kész</option>
                      <option value="blocked">Blokkolt</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "documents" && (
        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="font-semibold">Dokumentumok</h3>
            <label className="cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600">
              {uploading ? "Feltöltés..." : "+ Feltöltés"}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3">Fájlnév</th>
                <th className="px-4 py-3">Típus</th>
                <th className="px-4 py-3">Méret</th>
                <th className="px-4 py-3">Verzió</th>
                <th className="px-4 py-3">Feltöltve</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{doc.original_filename}</td>
                  <td className="px-4 py-3 text-gray-500">{doc.content_type}</td>
                  <td className="px-4 py-3 text-gray-500">{formatBytes(doc.file_size)}</td>
                  <td className="px-4 py-3">v{doc.version}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(doc.created_at).toLocaleString("hu-HU")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="mr-3 text-indigo-600 hover:underline"
                    >
                      Letöltés
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-500 hover:underline"
                    >
                      Törlés
                    </button>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nincs feltöltött dokumentum
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
