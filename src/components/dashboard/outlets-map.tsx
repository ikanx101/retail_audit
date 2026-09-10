"use client";

import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapOutlet {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  visitCount: number;
}

export function OutletsMap({ outlets }: { outlets: MapOutlet[] }) {
  const center: [number, number] =
    outlets.length > 0 ? [outlets[0].latitude, outlets[0].longitude] : [-2.5, 118];

  return (
    <div className="h-[480px] w-full overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={center} zoom={outlets.length > 0 ? 12 : 5} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {outlets.map((o) => (
          <Marker key={o.id} position={[o.latitude, o.longitude]} icon={markerIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{o.name}</p>
                <p className="text-xs text-slate-500">{o.address}</p>
                <p className="text-xs">{o.visitCount} kunjungan</p>
                <Link href={`/master/warungs/${o.id}`} className="text-xs text-blue-600 underline">
                  Lihat detail →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
