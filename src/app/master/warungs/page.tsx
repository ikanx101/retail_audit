"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { OutletsMapLazy } from "@/components/dashboard/outlets-map-lazy";

interface OutletListItem {
  id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  visitCount: number;
  lastVisitDate: string | null;
}

export default function MasterWarungsPage() {
  return (
    <React.Suspense fallback={null}>
      <MasterWarungsContent />
    </React.Suspense>
  );
}

function MasterWarungsContent() {
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["outlets", "all", searchParams.get("q")],
    queryFn: async (): Promise<OutletListItem[]> => {
      const params = new URLSearchParams();
      if (searchParams.get("q")) params.set("q", searchParams.get("q")!);
      const res = await fetch(`/api/outlets?${params.toString()}`);
      const json = await res.json();
      return json.data;
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Daftar & Sebaran Warung</h1>
      <FilterBar />

      {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}

      {data && (
        <div className="space-y-4">
          <OutletsMapLazy
            outlets={data.map((o) => ({
              id: o.id,
              name: o.name,
              address: o.address,
              latitude: Number(o.latitude),
              longitude: Number(o.longitude),
              visitCount: o.visitCount,
            }))}
          />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {data.map((o) => (
              <Link key={o.id} href={`/master/warungs/${o.id}`}>
                <Card className="transition hover:shadow-md">
                  <CardContent className="p-3">
                    <p className="font-medium text-slate-900">{o.name}</p>
                    <p className="text-xs text-slate-500">{o.address}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {o.visitCount} kunjungan · terakhir{" "}
                      {o.lastVisitDate ? new Date(o.lastVisitDate).toLocaleDateString("id-ID") : "-"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
