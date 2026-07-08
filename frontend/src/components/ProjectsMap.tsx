"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useRouter } from "next/navigation";
import { ProjectCard, STATUS_LABELS } from "@/lib/api";
import { HEALTH_CFG } from "@/lib/project-utils";

// Leaflet's default marker icon paths break under webpack/Next.js bundling
// (they resolve to file paths that don't exist in the built output) — point
// them at the CDN-hosted assets instead of trying to bundle the PNGs.
const DEFAULT_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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
    <div className="overflow-hidden rounded-lg border border-slate-100 shadow-sm">
      <MapContainer center={center} zoom={7} style={{ height: "560px", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={DEFAULT_ICON}>
            <Popup>
              <div className="min-w-[160px] text-sm">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-slate-500">{p.project_code} · {p.settlement}</p>
                <p className="mt-1 text-xs">{STATUS_LABELS[p.status] ?? p.status}</p>
                <p className="text-xs">{HEALTH_CFG[p.health]?.label ?? p.health}</p>
                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="mt-1.5 text-xs font-medium text-blue-600 hover:underline"
                >
                  Megnyitás →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {projects.length > withCoords.length && (
        <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          {projects.length - withCoords.length} projekthez nincs térképi koordináta — ezek csak a listanézetben látszanak.
        </p>
      )}
    </div>
  );
}
