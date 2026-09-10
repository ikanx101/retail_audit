"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface OutletListItem {
  id: string;
  name: string;
  address: string;
  lastVisitDate: string | null;
  visitCount: number;
}

export default function PilihWarungPage() {
  const [q, setQ] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["outlets", "mine"],
    queryFn: async (): Promise<OutletListItem[]> => {
      const res = await fetch("/api/outlets?mine=1");
      if (!res.ok) throw new Error("Gagal memuat data warung");
      const json = await res.json();
      return json.data;
    },
  });

  const filtered = (data ?? []).filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Pilih Warung — Kunjungan Ulang</h1>
      <Input placeholder="Cari nama warung..." value={q} onChange={(e) => setQ(e.target.value)} />

      {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-slate-400">Tidak ada warung yang cocok. Buat warung baru terlebih dahulu.</p>
      )}

      <div className="space-y-2">
        {filtered.map((o) => (
          <Link key={o.id} href={`/interviewer/warung/${o.id}/kunjungan/baru`}>
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
  );
}
