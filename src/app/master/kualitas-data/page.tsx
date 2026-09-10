"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { formatDateWIB } from "@/lib/timezone";

interface Anomaly {
  visitId: string;
  outlet: string;
  interviewer: string;
  visitDate: string;
  visitTime: string;
  reasons: string[];
}

export default function KualitasDataPage() {
  return (
    <React.Suspense fallback={null}>
      <KualitasDataContent />
    </React.Suspense>
  );
}

function KualitasDataContent() {
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["master-anomalies", searchParams.toString()],
    queryFn: async (): Promise<Anomaly[]> => {
      const res = await fetch(`/api/master/anomalies?${searchParams.toString()}`);
      const json = await res.json();
      return json.data;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Panel Kualitas Data</h1>
      <FilterBar />

      {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-emerald-600">Tidak ditemukan anomali pada data yang difilter. 🎉</p>
      )}

      <div className="space-y-2">
        {data?.map((a) => (
          <Card key={a.visitId} className="border-amber-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">
                  {a.outlet} — {formatDateWIB(a.visitDate)} {a.visitTime} WIB
                </p>
                <span className="text-xs text-slate-500">{a.interviewer}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {a.reasons.map((r, i) => (
                  <Badge key={i} variant="warning">
                    {r}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
