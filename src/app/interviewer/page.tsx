"use client";

import Link from "next/link";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useOnlineSync } from "@/lib/use-online-sync";

interface OutletListItem {
  id: string;
  name: string;
  address: string;
  lastVisitDate: string | null;
  visitCount: number;
}

export default function InterviewerHomePage() {
  const { pendingCount, isOnline } = useOnlineSync();

  const { data, isLoading } = useQuery({
    queryKey: ["outlets", "mine"],
    queryFn: async (): Promise<OutletListItem[]> => {
      const res = await fetch("/api/outlets?mine=1");
      if (!res.ok) throw new Error("Gagal memuat data warung");
      const json = await res.json();
      return json.data;
    },
  });

  const recentOutlets = (data ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Link href="/interviewer/warung/baru">
          <Card className="h-full transition hover:shadow-md">
            <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-3xl">🏪</span>
              <span className="font-semibold text-slate-900">Warung Baru</span>
              <span className="text-xs text-slate-500">Kunjungan pertama</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/interviewer/pilih-warung">
          <Card className="h-full transition hover:shadow-md">
            <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-3xl">🔁</span>
              <span className="font-semibold text-slate-900">Kunjungan Ulang</span>
              <span className="text-xs text-slate-500">Warung yang sudah ada</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Link href="/interviewer/sinkronisasi">
        <Card className={pendingCount > 0 ? "border-amber-300 bg-amber-50" : ""}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Status Sinkronisasi</p>
              <p className="text-xs text-slate-500">
                {isOnline ? "Terhubung ke internet" : "Sedang offline"} · {pendingCount} data menunggu
              </p>
            </div>
            <span className="text-slate-400">→</span>
          </CardContent>
        </Card>
      </Link>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Warung Terakhir Dikunjungi</h2>
        {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}
        {!isLoading && recentOutlets.length === 0 && (
          <p className="text-sm text-slate-400">Belum ada warung yang terdaftar.</p>
        )}
        <div className="space-y-2">
          {recentOutlets.map((o) => (
            <Link key={o.id} href={`/interviewer/warung/${o.id}`}>
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
    </div>
  );
}
