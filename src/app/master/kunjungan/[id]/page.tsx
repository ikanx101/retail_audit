"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { parseDecimalInput } from "@/lib/utils";

interface VisitDetail {
  id: string;
  visitNumber: number;
  visitDate: string;
  visitTime: string | null;
  weatherHotH: number | null;
  weatherClearH: number | null;
  weatherCloudyH: number | null;
  weatherDrizzleH: number | null;
  weatherRainH: number | null;
  notes: string | null;
  outlet: { id: string; name: string };
  interviewer: { fullName: string; username: string };
  sales: { brandId: string | null; brandNameSnapshot: string; sachetsSold: number; variantNote: string | null }[];
  photos: {
    id: string;
    form: "WEATHER" | "SALES";
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
  }[];
}

const photoFormLabel: Record<"WEATHER" | "SALES", string> = {
  WEATHER: "Cuaca",
  SALES: "Merek & Penjualan",
};

export default function MasterEditKunjunganPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [visitDate, setVisitDate] = React.useState("");
  const [visitTime, setVisitTime] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [weather, setWeather] = React.useState<WeatherState>({
    weatherHotH: "0",
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

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ["master-visit", params.id],
    retry: false,
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
      setVisitTime(visit.visitTime ?? "");
      setNotes(visit.notes ?? "");
      setWeather({
        weatherHotH: String(visit.weatherHotH ?? 0),
        weatherClearH: String(visit.weatherClearH ?? 0),
        weatherCloudyH: String(visit.weatherCloudyH ?? 0),
        weatherDrizzleH: String(visit.weatherDrizzleH ?? 0),
        weatherRainH: String(visit.weatherRainH ?? 0),
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

  function buildPayload(overwriteId?: string) {
    return {
      visitDate,
      visitTime,
      notes: notes || null,
      confirmOverwriteVisitId: overwriteId,
      weatherHotH: parseDecimalInput(weather.weatherHotH || "0"),
      weatherClearH: parseDecimalInput(weather.weatherClearH || "0"),
      weatherCloudyH: parseDecimalInput(weather.weatherCloudyH || "0"),
      weatherDrizzleH: parseDecimalInput(weather.weatherDrizzleH || "0"),
      weatherRainH: parseDecimalInput(weather.weatherRainH || "0"),
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

  async function actuallySubmit(overwriteId?: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/master/visits/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(overwriteId)),
      });
      if (res.ok) {
        toast({ title: "Perubahan tersimpan", kind: "success" });
        await queryClient.invalidateQueries({ queryKey: ["master-visits"] });
        await queryClient.invalidateQueries({ queryKey: ["master-anomalies"] });
        if (visit) await queryClient.invalidateQueries({ queryKey: ["outlet", visit.outlet.id] });
        router.push("/master/kunjungan");
        return;
      }
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "DUPLICATE_DATE_MOVE" && body?.existingVisitId) {
          setConfirmState({
            open: true,
            message: body?.message ?? "Warung ini sudah punya kunjungan pada tanggal baru tersebut. Data lama akan digantikan. Lanjutkan?",
            onConfirm: () => {
              setConfirmState({ open: false, message: "" });
              actuallySubmit(body.existingVisitId);
            },
          });
          return;
        }
        toast({ title: "Gagal menyimpan", description: body?.message ?? body?.error, kind: "error" });
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
        await queryClient.invalidateQueries({ queryKey: ["master-visits"] });
        await queryClient.invalidateQueries({ queryKey: ["master-anomalies"] });
        if (visit) await queryClient.invalidateQueries({ queryKey: ["outlet", visit.outlet.id] });
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

  if (isLoading) return <p className="text-sm text-slate-400">Memuat...</p>;
  if (isError || !visit) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">
          Kunjungan tidak ditemukan — mungkin sudah dihapus atau tautannya tidak valid.
        </p>
        <Link href="/master/kunjungan" className="text-sm text-blue-600 underline">
          ← Kembali ke tabel kunjungan
        </Link>
      </div>
    );
  }

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
        {(visit.weatherClearH == null || visit.visitTime == null) && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Sejak v2.5, interviewer mengisi cuaca & penjualan lewat dua formulir terpisah — kunjungan
            ini belum lengkap ({visit.weatherClearH == null && "cuaca belum diisi"}
            {visit.weatherClearH == null && visit.visitTime == null && ", "}
            {visit.visitTime == null && "penjualan belum diisi"}). Menyimpan perubahan di sini akan
            melengkapi bagian yang kosong dengan nilai pada formulir.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Waktu Kunjungan</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="visitDate">Tanggal kunjungan</Label>
                <Input id="visitDate" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
                <p className="mt-1 text-[11px] text-slate-400">
                  Bila warung ini sudah punya kunjungan lain di tanggal baru, akan ada konfirmasi
                  sebelum data lama itu digantikan.
                </p>
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

        {visit.photos.length > 0 && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-slate-700">
                Foto Lampiran ({visit.photos.length})
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {visit.photos.map((photo) => {
                  const viewUrl = `/api/master/visits/${visit.id}/photos/${photo.id}`;
                  return (
                    <div key={photo.id} className="space-y-1">
                      <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={viewUrl}
                          alt={photo.fileName}
                          className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                        />
                      </a>
                      <p className="truncate text-[10px] text-slate-500" title={photo.fileName}>
                        {photoFormLabel[photo.form]} · {(photo.sizeBytes / 1024).toFixed(0)} KB
                      </p>
                      <a
                        href={`${viewUrl}?download=1`}
                        className="text-[10px] text-blue-600 underline"
                        download={photo.fileName}
                      >
                        Unduh
                      </a>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
