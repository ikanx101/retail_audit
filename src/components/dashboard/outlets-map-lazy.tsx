"use client";

import dynamic from "next/dynamic";

export const OutletsMapLazy = dynamic(() => import("./outlets-map").then((m) => m.OutletsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
      Memuat peta...
    </div>
  ),
});
