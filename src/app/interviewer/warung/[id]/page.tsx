"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { buttonClassNames } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateWIB } from "@/lib/timezone";
import { roundHours } from "@/lib/utils";

interface VisitSale {
  brandNameSnapshot: string;
  sachetsSold: number;
}

interface Visit {
  id: string;
  visitNumber: number;
  visitDate: string;
  visitTime: string | null;
  weatherClearH: number | null;
  weatherCloudyH: number | null;
  weatherDrizzleH: number | null;
  weatherRainH: number | null;
  weatherFilled: boolean;
  salesFilled: boolean;
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

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/interviewer/warung/${data.id}/kunjungan/cuaca`}
          className={buttonClassNames({ size: "lg", className: "w-full" })}
        >
          🌦️ Isi Data Cuaca
        </Link>
        <Link
          href={`/interviewer/warung/${data.id}/kunjungan/penjualan`}
          className={buttonClassNames({ size: "lg", variant: "outline", className: "w-full" })}
        >
          🥤 Isi Data Penjualan
        </Link>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Riwayat Kunjungan</h2>
        <div className="space-y-2">
          {data.visits.map((v) => {
            const totalJam =
              v.weatherClearH != null
                ? roundHours(v.weatherClearH + (v.weatherCloudyH ?? 0) + (v.weatherDrizzleH ?? 0) + (v.weatherRainH ?? 0))
                : null;
            const totalSachet = v.sales.reduce((s, x) => s + x.sachetsSold, 0);
            // Kunjungan #1 (registrasi) hanya tampil sebagai "registrasi tanpa data" jika
            // memang belum ada cuaca/penjualan — jika interviewer mengisi formulir cuaca/
            // penjualan di hari yang sama, backend menyatukannya ke kunjungan #1 ini
            // (satu visit per outlet per tanggal), jadi datanya tetap harus ditampilkan.
            const isEmptyFirstVisit = v.visitNumber === 1 && !v.weatherFilled && !v.salesFilled;
            return (
              <Card key={v.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">
                      Kunjungan #{v.visitNumber} — {formatDateWIB(v.visitDate)}
                    </p>
                    {v.visitTime && <Badge variant="info">{v.visitTime} WIB</Badge>}
                  </div>
                  {isEmptyFirstVisit ? (
                    <p className="mt-1 text-xs text-slate-400">Registrasi warung (tanpa data cuaca/penjualan).</p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-slate-500">
                        {v.weatherFilled
                          ? `Total jam cuaca tercatat: ${totalJam} jam`
                          : "Cuaca belum diisi"}
                        {" · "}
                        {v.salesFilled
                          ? `Sachet terjual hari itu (hingga jam kunjungan): ${totalSachet}`
                          : "Penjualan belum diisi"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {!v.weatherFilled && <Badge variant="warning">Cuaca belum diisi</Badge>}
                        {!v.salesFilled && <Badge variant="warning">Penjualan belum diisi</Badge>}
                        {v.sales.map((s, i) => (
                          <Badge key={i} variant="default">
                            {s.brandNameSnapshot}: {s.sachetsSold}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
