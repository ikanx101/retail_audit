"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { WeatherHoursEditor, type WeatherState } from "@/components/forms/weather-hours-editor";
import { SalesRowsEditor, type SaleRowState } from "@/components/forms/sales-rows-editor";
import { masterEditVisitSchema } from "@/lib/validations";
import { isTotalSachetsLarge, isVisitTimeUnusual } from "@/lib/business-rules";
import { formatDateWIB } from "@/lib/timezone";

interface VisitDetail {
  id: string;
  visitNumber: number;
  visitDate: string;
  visitTime: string;
  weatherClearH: number;
  weatherCloudyH: number;
  weatherDrizzleH: number;
  weatherRainH: number;
  notes: string | null;
  outlet: { id: string; name: string };
  interviewer: { fullName: string; username: string };
  sales: { brandId: string | null; brandNameSnapshot: string; sachetsSold: number; variantNote: string | null }[];
}

export default function MasterEditKunjunganPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [visitDate, setVisitDate] = React.useState("");
  const [visitTime, setVisitTime] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [weather, setWeather] = React.useState<WeatherState>({
    weatherClearH: "0",
    weatherCloudyH: "0",
    weatherDrizzleH: "0",
    weatherRainH: "0",
  });
  const [sales, setSales] = React.useState<SaleRowState[]>([]);
  const [confirmState, setConfirmState] = React.useState<{ open: boolean; message: string; onConfirm?: () => void }>(
    { open: false, message: "" }
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const loaded = React.useRef(false);

  const { data: brandOptions } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const res = await fetch("/api/brands");
      const json = await res.json();
      return (json.data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: visit, isLoading } = useQuery({
    queryKey: ["master-visit", params.id],
    queryFn: async (): Promise<VisitDetail> => {
      const res = await fetch(`/api/master/visits/${params.id}`);
      if (!res.ok) throw new Error("Kunjungan tidak ditemukan");
      const json = await res.json();
      return json.data;
    },
  });

  React.useEffect(() => {
    if (visit && !loaded.current) {
      loaded.current = true;
      setVisitDate(visit.visitDate.slice(0, 10));
      setVisitTime(visit.visitTime);
      setNotes(visit.notes ?? "");
      setWeather({
        weatherClearH: String(visit.weatherClearH),
        weatherCloudyH: String(visit.weatherCloudyH),
        weatherDrizzleH: String(visit.weatherDrizzleH),
        weatherRainH: String(visit.weatherRainH),
      });
      setSales(
        visit.sales.map((s) => ({
          key: crypto.randomUUID(),
          brandId: s.brandId,
          brandName: s.brandNameSnapshot,
          sachetsSold: String(s.sachetsSold),
          variantNote: s.variantNote ?? "",
        }))
      );
    }
  }, [visit]);

  function buildPayload() {
    return {
      visitDate,
      visitTime,
      notes: notes || null,
      weatherClearH: Number(weather.weatherClearH || 0),
      weatherCloudyH: Number(weather.weatherCloudyH || 0),
      weatherDrizzleH: Number(weather.weatherDrizzleH || 0),
      weatherRainH: Number(weather.weatherRainH || 0),
      sales: sales
        .filter((s) => s.brandName.trim() !== "")
        .map((s) => ({
          brandId: s.brandId,
          brandName: s.brandName.trim(),
          sachetsSold: Number(s.sachetsSold || 0),
          variantNote: s.variantNote || null,
          isNewBrand: !s.brandId,
        })),
    };
  }

  async function actuallySubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/master/visits/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) {
        toast({ title: "Perubahan tersimpan", kind: "success" });
        router.push("/master/kunjungan");
        return;
      }
      const body = await res.json().catch(() => ({}));
      toast({ title: "Gagal menyimpan", description: body?.error, kind: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    const parsed = masterEditVisitSchema.safeParse(payload);
    if (!parsed.success) {
      toast({ title: "Periksa kembali isian", description: parsed.error.issues[0]?.message, kind: "error" });
      return;
    }

    if (isVisitTimeUnusual(payload.visitTime)) {
      setConfirmState({
        open: true,
        message: "Jam kunjungan di luar 04:00–23:00. Yakin jam ini benar?",
        onConfirm: () => {
          setConfirmState({ open: false, message: "" });
          checkTotal(payload);
        },
      });
      return;
    }
    checkTotal(payload);
  }

  function checkTotal(payload: ReturnType<typeof buildPayload>) {
    if (isTotalSachetsLarge(payload.sales.map((s) => ({ sachets: s.sachetsSold })))) {
      setConfirmState({
        open: true,
        message: "Total penjualan hari ini cukup besar untuk satu warung. Yakin angka ini benar?",
        onConfirm: () => {
          setConfirmState({ open: false, message: "" });
          actuallySubmit();
        },
      });
      return;
    }
    actuallySubmit();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/master/visits/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Kunjungan dihapus", kind: "success" });
        router.push("/master/kunjungan");
        return;
      }
      const body = await res.json().catch(() => ({}));
      toast({ title: "Gagal menghapus", description: body?.error, kind: "error" });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  if (isLoading || !visit) return <p className="text-sm text-slate-400">Memuat...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Edit Kunjungan #{visit.visitNumber} — {visit.outlet.name}
        </h1>
        <p className="text-xs text-slate-500">
          Diinput oleh {visit.interviewer.fullName} ({visit.interviewer.username}) ·{" "}
          {formatDateWIB(visit.visitDate)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Waktu Kunjungan</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="visitDate">Tanggal kunjungan</Label>
                <Input id="visitDate" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="visitTime">Jam kunjungan</Label>
                <Input id="visitTime" type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Kondisi Cuaca (dalam jam)</h2>
            <WeatherHoursEditor value={weather} onChange={setWeather} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Sachet terjual hari ini (hingga jam kunjungan)
            </h2>
            <SalesRowsEditor rows={sales} onChange={setSales} brandOptions={brandOptions ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Label htmlFor="notes">Catatan kunjungan (opsional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="lg"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
          >
            Hapus Kunjungan
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmState.open}
        title="Konfirmasi"
        description={confirmState.message}
        onConfirm={() => confirmState.onConfirm?.()}
        onCancel={() => setConfirmState({ open: false, message: "" })}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Hapus kunjungan ini?"
        description="Data kunjungan ini akan disembunyikan dari dashboard, grafik, dan export (soft delete — tetap tersimpan untuk audit). Tindakan ini bisa berdampak pada riwayat warung terkait."
        confirmLabel="Ya, hapus"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
