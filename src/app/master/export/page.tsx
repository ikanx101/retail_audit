"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/dashboard/filter-bar";

export default function MasterExportPage() {
  return (
    <React.Suspense fallback={null}>
      <MasterExportContent />
    </React.Suspense>
  );
}

function MasterExportContent() {
  const searchParams = useSearchParams();

  function download(format: "csv" | "xlsx", layout: "long" | "wide") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", format);
    params.set("layout", layout);
    window.location.href = `/api/export?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Unduh Data</h1>
      <p className="text-sm text-slate-500">
        Filter mengikuti pengaturan di bawah ini. Semua tanggal & jam ditampilkan dalam WIB.
      </p>
      <FilterBar />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Long Format</CardTitle>
            <CardDescription>Satu baris per kombinasi kunjungan × merek — cocok untuk analisis.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 p-4">
            <Button onClick={() => download("csv", "long")} className="flex-1">
              Unduh CSV
            </Button>
            <Button onClick={() => download("xlsx", "long")} variant="outline" className="flex-1">
              Unduh XLSX
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wide Format</CardTitle>
            <CardDescription>Satu baris per kunjungan, kolom merek dinamis — cocok untuk pivot cepat.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 p-4">
            <Button onClick={() => download("csv", "wide")} className="flex-1">
              Unduh CSV
            </Button>
            <Button onClick={() => download("xlsx", "wide")} variant="outline" className="flex-1">
              Unduh XLSX
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
