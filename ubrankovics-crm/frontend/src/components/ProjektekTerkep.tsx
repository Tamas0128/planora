"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";
import { ProjektListItem } from "@/lib/api";

export const ALLAPOT_LABEL: Record<string, string> = {
  uj: "Új",
  ajanlat: "Ajánlat",
  szerzodott: "Szerződött",
  kivitelezes: "Kivitelezés",
  lezart: "Lezárt",
};

// Állapotszínek a rendszer saját tokenjeiből (erdőzöld = aktív munka, borostyán = ajánlat, agyag = új, barna = lezárt).
export const ALLAPOT_SZIN: Record<string, string> = {
  uj: "#6b6049",
  ajanlat: "#b8873a",
  szerzodott: "#5f9268",
  kivitelezes: "#22582b",
  lezart: "#a89b7c",
};

function pin(allapot: string) {
  return L.divIcon({
    className: "terkep-pin",
    html: `<span style="background:${ALLAPOT_SZIN[allapot] || "#22582b"}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

const MAGYARORSZAG: [number, number] = [47.1625, 19.5033];

function Illeszt({ pontok }: { pontok: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pontok.length === 0) return;
    if (pontok.length === 1) map.setView(pontok[0], 13);
    else map.fitBounds(L.latLngBounds(pontok), { padding: [40, 40], maxZoom: 14 });
  }, [map, pontok]);
  return null;
}

export default function ProjektekTerkep({ projektek }: { projektek: ProjektListItem[] }) {
  const pontos = projektek.filter(
    (p): p is ProjektListItem & { latitude: number; longitude: number } => p.latitude != null && p.longitude != null
  );
  const pontok = pontos.map((p) => [p.latitude, p.longitude] as [number, number]);

  return (
    <div className="projekt-terkep overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
      <MapContainer center={MAGYARORSZAG} zoom={7} style={{ height: "min(62vh, 560px)", minHeight: 360, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Illeszt pontok={pontok} />
        {pontos.map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={pin(p.allapot)}>
            <Popup>
              <div className="min-w-44 text-sm">
                <p className="font-heading font-semibold">{p.projekt_nev}</p>
                {p.ugyfel_nev && <p className="text-xs">{p.ugyfel_nev}</p>}
                {p.epitesi_cim && <p className="text-xs">{p.epitesi_cim}</p>}
                <p className="mt-1 text-xs font-medium" style={{ color: ALLAPOT_SZIN[p.allapot] }}>
                  {ALLAPOT_LABEL[p.allapot] || p.allapot}
                </p>
                <Link href={`/projektek/${p.id}`} className="mt-1.5 inline-block text-xs font-medium text-[var(--primary)] underline">
                  Megnyitás
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
