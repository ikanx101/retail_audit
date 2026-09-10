"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClassNames } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateWIB } from "@/lib/timezone";

interface VisitSale {
  brandNameSnapshot: string;
  sachetsSold: number;
}

interface Visit {
  id: string;
  visitNumber: number;
  visitDate: string;
  visitTime: string;
  weatherClearH: number;
  weatherCloudyH: number;
  weatherDrizzleH: number;
  weatherRainH: number;
  sales: VisitSale[];
}

interface OutletDetail {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  phone: string;
  openingTime: string | null;
  closingTime: string | null;
  visits: Visit[];
}

export default function WarungDetailPage() {
  const params = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["outlet", params.id],
    queryFn: async (): Promise<OutletDetail> => {
      const res = await fetch(`/api/outlets/${params.id}`);
      const json = await res.json();
      return json.data;
    },
  });

  if (isLoading) return <p className="text-sm text-slate-400">Memuat...</p>;
  if (!data) return <p className="text-sm text-red-600">Warung tidak ditemukan.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h1 className="text-lg font-semibold text-slate-900">{data.name}</h1>
          <p className="text-sm text-slate-500">{data.address}</p>
          <p className="mt-1 text-xs text-slate-400">
            Pemilik: {data.ownerName} · {data.phone}
          </p>
          {(data.openingTime || data.closingTime) && (
            <p className="mt-1 text-xs text-slate-400">
              Jam operasional: {data.openingTime ?? "-"} – {data.closingTime ?? "-"}
            </p>
          )}
        </CardContent>
      </Card>

      <Link
        href={`/interviewer/warung/${data.id}/kunjungan/baru`}
        className={buttonClassNames({ size: "lg", className: "w-full" })}
      >
        + Kunjungan Ulang
      </Link>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Riwayat Kunjungan</h2>
        <div className="space-y-2">
          {data.visits.map((v) => {
            const totalJam = v.weatherClearH + v.weatherCloudyH + v.weatherDrizzleH + v.weatherRainH;
            const totalSachet = v.sales.reduce((s, x) => s + x.sachetsSold, 0);
            return (
              <Card key={v.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">
                      Kunjungan #{v.visitNumber} — {formatDateWIB(v.visitDate)}
                    </p>
                    <Badge variant="info">{v.visitTime} WIB</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Total jam cuaca tercatat: {totalJam} jam · Sachet terjual hari itu (hingga jam kunjungan): {totalSachet}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.sales.map((s, i) => (
                      <Badge key={i} variant="default">
                        {s.brandNameSnapshot}: {s.sachetsSold}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
