"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { StatCard } from "@/components/dashboard/stat-card";

interface SummaryData {
  outletCount: number;
  visitCount: number;
  activeInterviewerCount: number;
  totalSachets: number;
  avgSachetsPerOutlet: number;
  brandCount: number;
  trend: { date: string; total: number }[];
  brandComposition: { brand: string; total: number }[];
  perInterviewer: { interviewer: string; total: number }[];
}

export default function MasterDashboardPage() {
  return (
    <React.Suspense fallback={null}>
      <MasterDashboardContent />
    </React.Suspense>
  );
}

function MasterDashboardContent() {
  const searchParams = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["master-summary", searchParams.toString()],
    queryFn: async (): Promise<SummaryData> => {
      const res = await fetch(`/api/master/summary?${searchParams.toString()}`);
      const json = await res.json();
      return json.data;
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Dashboard Ringkasan</h1>
      <FilterBar />

      {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Jumlah Warung" value={data.outletCount} />
            <StatCard label="Jumlah Kunjungan" value={data.visitCount} />
            <StatCard label="Interviewer Aktif" value={data.activeInterviewerCount} />
            <StatCard label="Total Sachet Terjual" value={data.totalSachets.toLocaleString("id-ID")} />
            <StatCard label="Rata-rata Sachet/Warung" value={data.avgSachetsPerOutlet} />
            <StatCard label="Jumlah Merek Tercatat" value={data.brandCount} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tren Sachet Terjual per Hari</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Komposisi Penjualan per Merek (Top 10)</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.brandComposition} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="brand" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Sebaran Penjualan per Interviewer</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.perInterviewer}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="interviewer" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
