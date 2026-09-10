"use client";

import dynamic from "next/dynamic";

export const LocationPickerLazy = dynamic(
  () => import("./location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-sm text-slate-400">
        Memuat peta...
      </div>
    ),
  }
);
