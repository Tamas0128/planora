"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useRouter } from "next/navigation";
import { ProjectCard, STATUS_LABELS } from "@/lib/api";
import { DEFAULT_CFG, HEALTH_CFG, STATUS_CFG } from "@/lib/project-utils";

// Leaflet's default marker icon paths break under webpack/Next.js bundling
// (they resolve to file paths that don't exist in the built output), so pins
// are built as colored divIcons instead of the stock PNG marker. Colors reuse
// the same STATUS_CFG.progressBar classes the Kanban/List/Card views already
// use, so a pin's color matches its status badge everywhere else in the app.
const STATUS_ICON_CACHE: Record<string, L.DivIcon> = {};

function statusIcon(status: string): L.DivIcon {
  if (!STATUS_ICON_CACHE[status]) {
    const cfg = STATUS_CFG[status] ?? DEFAULT_CFG;
    STATUS_ICON_CACHE[status] = L.divIcon({
      className: "",
      html: `<span class="block size-5 rounded-full border-2 border-white shadow-md ${cfg.progressBar}"></span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });
  }
  return STATUS_ICON_CACHE[status];
}

const BUDAPEST_CENTER: [number, number] = [47.4979, 19.0402];

export default function ProjectsMap({ projects }: { projects: ProjectCard[] }) {
  const router = useRouter();
  const withCoords = projects.filter(
    (p): p is ProjectCard & { latitude: number; longitude: number } =>
      p.latitude != null && p.longitude != null
  );

  const center: [number, number] =
    withCoords.length > 0 ? [withCoords[0].latitude, withCoords[0].longitude] : BUDAPEST_CENTER;

  return (
    <div className="overflow-hidden border border-border shadow-sm">
      <MapContainer center={center} zoom={7} style={{ height: "560px", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={statusIcon(p.status)}>
            <Popup>
              <div className="min-w-[160px] text-sm">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.project_code} · {p.settlement}</p>
                <p className="mt-1 text-xs">{STATUS_LABELS[p.status] ?? p.status}</p>
                <p className="text-xs">{HEALTH_CFG[p.health]?.label ?? p.health}</p>
                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="mt-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Megnyitás →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {projects.length > withCoords.length && (
        <p className="border-t border-border bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">
          {projects.length - withCoords.length} projekthez nincs térképi koordináta — ezek csak a listanézetben látszanak.
        </p>
      )}
    </div>
  );
}
