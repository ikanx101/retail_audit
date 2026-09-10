"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  visits: Visit[];
}

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

export default function MasterWarungDetailPage() {
  const params = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["outlet", params.id],
    queryFn: async (): Promise<OutletDetail> => {
      const res = await fetch(`/api/outlets/${params.id}`);
      const json = await res.json();
      return json.data;
    },
  });

  const chartData = React.useMemo(() => {
    if (!data) return [];
    const brandSet = new Set<string>();
    data.visits.forEach((v) => v.sales.forEach((s) => brandSet.add(s.brandNameSnapshot)));
    const brands = [...brandSet];

    return [...data.visits]
      .sort((a, b) => a.visitDate.localeCompare(b.visitDate))
      .map((v) => {
        const row: Record<string, string | number> = { tanggal: formatDateWIB(v.visitDate) };
        brands.forEach((b) => {
          row[b] = v.sales.find((s) => s.brandNameSnapshot === b)?.sachetsSold ?? 0;
        });
        return row;
      });
  }, [data]);

  const brandKeys = React.useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.visits.forEach((v) => v.sales.forEach((s) => set.add(s.brandNameSnapshot)));
    return [...set];
  }, [data]);

  if (isLoading || !data) return <p className="text-sm text-slate-400">Memuat...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h1 className="text-lg font-semibold text-slate-900">{data.name}</h1>
          <p className="text-sm text-slate-500">{data.address}</p>
          <p className="mt-1 text-xs text-slate-400">
            Pemilik: {data.ownerName} · {data.phone}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tren Penjualan per Merek</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {brandKeys.map((b, i) => (
                <Line key={b} type="monotone" dataKey={b} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
                    Total jam cuaca: {totalJam}/24 · Sachet terjual hari itu (hingga jam kunjungan): {totalSachet}
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
