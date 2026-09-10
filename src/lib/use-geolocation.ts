"use client";

import * as React from "react";

export interface GeoResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
}

export function useGeolocation() {
  const [result, setResult] = React.useState<GeoResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const capture = React.useCallback(() => {
    if (!("geolocation" in navigator)) {
      setErrorMsg("Perangkat tidak mendukung geolokasi. Gunakan input manual.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResult({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: pos.timestamp,
        });
        setLoading(false);
      },
      (err) => {
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? "Izin lokasi ditolak. Silakan masukkan koordinat secara manual."
            : "Gagal mengambil lokasi. Coba lagi atau masukkan manual."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  return { result, loading, errorMsg, capture, setResult };
}
