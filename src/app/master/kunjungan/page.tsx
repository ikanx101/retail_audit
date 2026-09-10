"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDateWIB } from "@/lib/timezone";

interface VisitRow {
  id: string;
  outlet: { id: string; name: string; address: string; city: string | null };
  interviewer: { fullName: string; username: string };
  visitNumber: number;
  visitDate: string;
  visitTime: string;
  weather: { clear: number; cloudy: number; drizzle: number; rain: number; total: number };
  sales: { brand: string; sachetsSold: number; isNewBrand: boolean }[];
  totalSachets: number;
  isOfflineCreated: boolean;
}

export default function MasterKunjunganPage() {
  return (
    <React.Suspense fallback={null}>
      <MasterKunjunganContent />
    </React.Suspense>
  );
}

function MasterKunjunganContent() {
  const searchParams = useSearchParams();
  const [page, setPage] = React.useState(1);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; outletName: string } | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryString = searchParams.toString();

  const { data, isLoading } = useQuery({
    queryKey: ["master-visits", queryString, page],
    queryFn: async () => {
      const params = new URLSearchParams(queryString);
      params.set("page", String(page));
      params.set("pageSize", "20");
      const res = await fetch(`/api/master/visits?${params.toString()}`);
      const json = await res.json();
      return json as { data: VisitRow[]; meta: { total: number; page: number; pageCount: number } };
    },
  });

  React.useEffect(() => {
    setPage(1);
  }, [queryString]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/master/visits/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Kunjungan dihapus", kind: "success" });
        queryClient.invalidateQueries({ queryKey: ["master-visits"] });
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Gagal menghapus", description: body?.error, kind: "error" });
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Tabel Kunjungan</h1>
      <FilterBar />

      {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Interviewer</th>
                <th className="px-3 py-2">Warung</th>
                <th className="px-3 py-2">Alamat</th>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Jam Kunjungan</th>
                <th className="px-3 py-2">Cuaca (jam)</th>
                <th className="px-3 py-2">Merek & Sachet</th>
                <th className="px-3 py-2">Sumber</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2">{v.interviewer.fullName}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{v.outlet.name}</td>
                  <td className="px-3 py-2 text-slate-500">{v.outlet.address}</td>
                  <td className="px-3 py-2">{formatDateWIB(v.visitDate)}</td>
                  <td className="px-3 py-2">{v.visitTime} WIB</td>
                  <td className="px-3 py-2">
                    C:{v.weather.clear} M:{v.weather.cloudy} G:{v.weather.drizzle} H:{v.weather.rain} (
                    {v.weather.total})
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {v.sales.map((s, i) => (
                        <Badge key={i} variant={s.isNewBrand ? "info" : "default"}>
                          {s.brand}: {s.sachetsSold}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-700">Total: {v.totalSachets}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={v.isOfflineCreated ? "warning" : "success"}>
                      {v.isOfflineCreated ? "Offline" : "Online"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link href={`/master/kunjungan/${v.id}`}>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleteTarget({ id: v.id, outletName: v.outlet.name })}
                      >
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between p-3">
            <p className="text-xs text-slate-500">
              Total {data.meta.total} kunjungan — Halaman {data.meta.page} / {Math.max(1, data.meta.pageCount)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.meta.pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Hapus kunjungan ini?"
        description={
          deleteTarget
            ? `Kunjungan untuk "${deleteTarget.outletName}" akan disembunyikan dari dashboard, grafik, dan export (soft delete — tetap tersimpan untuk audit).`
            : ""
        }
        confirmLabel={deleting ? "Menghapus..." : "Ya, hapus"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
