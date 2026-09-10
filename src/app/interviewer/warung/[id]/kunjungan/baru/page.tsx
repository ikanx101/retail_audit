"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { LocationPickerLazy } from "@/components/forms/location-picker-lazy";
import { WeatherHoursEditor, type WeatherState } from "@/components/forms/weather-hours-editor";
import { SalesRowsEditor, type SaleRowState } from "@/components/forms/sales-rows-editor";
import { useGeolocation } from "@/lib/use-geolocation";
import { revisitSchema } from "@/lib/validations";
import { isGpsAccuracyPoor, isTotalSachetsLarge, isVisitTimeUnusual } from "@/lib/business-rules";
import { todayWIB, nowTimeWIB } from "@/lib/timezone";
import { saveDraft, loadDraft, clearDraft, enqueueSubmission } from "@/lib/offline-db";

interface OutletDetail {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  prefillBrands: { brandId: string | null; brandName: string; variantNote: string | null }[];
}

export default function KunjunganUlangPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const geo = useGeolocation();
  const draftKey = `revisit:${params.id}`;

  const { data: brandOptions } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const res = await fetch("/api/brands");
      const json = await res.json();
      return (json.data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: outlet, isLoading } = useQuery({
    queryKey: ["outlet", params.id],
    queryFn: async (): Promise<OutletDetail> => {
      const res = await fetch(`/api/outlets/${params.id}`);
      const json = await res.json();
      return json.data;
    },
  });

  const [clientUuid] = React.useState(() => crypto.randomUUID());
  const [visitDate, setVisitDate] = React.useState(todayWIB());
  const [visitTime, setVisitTime] = React.useState(nowTimeWIB());
  const [visitNotes, setVisitNotes] = React.useState("");
  const [weather, setWeather] = React.useState<WeatherState>({
    weatherClearH: "0",
    weatherCloudyH: "0",
    weatherDrizzleH: "0",
    weatherRainH: "0",
  });
  const [sales, setSales] = React.useState<SaleRowState[]>([]);
  const [updateLocation, setUpdateLocation] = React.useState(false);
  const [lat, setLat] = React.useState(0);
  const [lng, setLng] = React.useState(0);
  const [accuracyM, setAccuracyM] = React.useState<number | null>(null);
  const [confirmState, setConfirmState] = React.useState<{ open: boolean; message: string; onConfirm?: () => void }>({
    open: false,
    message: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const prefillLoaded = React.useRef(false);

  React.useEffect(() => {
    if (outlet && !prefillLoaded.current) {
      prefillLoaded.current = true;
      setLat(Number(outlet.latitude));
      setLng(Number(outlet.longitude));
      loadDraft(draftKey).then((draft) => {
        if (draft) {
          const d = draft as Record<string, unknown>;
          setVisitDate((d.visitDate as string) ?? todayWIB());
          setVisitTime((d.visitTime as string) ?? nowTimeWIB());
          setVisitNotes((d.visitNotes as string) ?? "");
          if (d.weather) setWeather(d.weather as WeatherState);
          if (Array.isArray(d.sales) && d.sales.length > 0) {
            setSales(d.sales as SaleRowState[]);
            return;
          }
        }
        setSales(
          outlet.prefillBrands.length > 0
            ? outlet.prefillBrands.map((b) => ({
                key: crypto.randomUUID(),
                brandId: b.brandId,
                brandName: b.brandName,
                sachetsSold: "",
                variantNote: b.variantNote ?? "",
              }))
            : [{ key: crypto.randomUUID(), brandId: null, brandName: "", sachetsSold: "", variantNote: "" }]
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet]);

  React.useEffect(() => {
    if (geo.result) {
      setLat(geo.result.latitude);
      setLng(geo.result.longitude);
      setAccuracyM(geo.result.accuracy);
      setUpdateLocation(true);
    }
  }, [geo.result]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraft(draftKey, { visitDate, visitTime, visitNotes, weather, sales });
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitDate, visitTime, visitNotes, weather, sales]);

  function buildPayload(overwriteId?: string) {
    return {
      outletId: params.id,
      clientUuid,
      confirmOverwriteVisitId: overwriteId,
      visitDate,
      visitTime,
      visitNotes: visitNotes || null,
      weatherClearH: Number(weather.weatherClearH || 0),
      weatherCloudyH: Number(weather.weatherCloudyH || 0),
      weatherDrizzleH: Number(weather.weatherDrizzleH || 0),
      weatherRainH: Number(weather.weatherRainH || 0),
      updateLocation,
      latitude: updateLocation ? lat : undefined,
      longitude: updateLocation ? lng : undefined,
      accuracyM: updateLocation ? accuracyM : undefined,
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
    const payload = buildPayload(overwriteId);
    setSubmitting(true);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await clearDraft(draftKey);
        toast({ title: "Kunjungan ulang tersimpan", kind: "success" });
        router.push(`/interviewer/warung/${params.id}`);
        return;
      }
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "DUPLICATE_DATE" && body?.existingVisitId) {
          setConfirmState({
            open: true,
            message: "Sudah ada kunjungan pada tanggal ini untuk warung ini. Perbarui kunjungan yang ada?",
            onConfirm: () => {
              setConfirmState({ open: false, message: "" });
              actuallySubmit(body.existingVisitId);
            },
          });
          return;
        }
      }
      const body = await res.json().catch(() => ({}));
      toast({ title: "Gagal menyimpan", description: body?.message ?? body?.error, kind: "error" });
    } catch {
      await enqueueSubmission(clientUuid, "revisit", payload);
      await clearDraft(draftKey);
      toast({
        title: "Tersimpan secara offline",
        description: "Data akan otomatis tersinkron saat koneksi kembali.",
        kind: "info",
      });
      router.push("/interviewer");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    const parsed = revisitSchema.safeParse(payload);
    if (!parsed.success) {
      toast({ title: "Periksa kembali isian Anda", description: parsed.error.issues[0]?.message, kind: "error" });
      return;
    }

    if (isVisitTimeUnusual(payload.visitTime)) {
      setConfirmState({
        open: true,
        message: "Jam kunjungan di luar 04:00–23:00. Yakin jam ini benar?",
        onConfirm: () => {
          setConfirmState({ open: false, message: "" });
          proceedTotalCheck(payload);
        },
      });
      return;
    }
    proceedTotalCheck(payload);
  }

  function proceedTotalCheck(payload: ReturnType<typeof buildPayload>) {
    if (isTotalSachetsLarge(payload.sales.map((s) => ({ sachets: s.sachetsSold })))) {
      setConfirmState({
        open: true,
        message: "Total penjualan hari ini cukup besar untuk satu warung. Yakin angka ini penjualan hari ini, bukan kumulatif?",
        onConfirm: () => {
          setConfirmState({ open: false, message: "" });
          proceedAccuracyCheck();
        },
      });
      return;
    }
    proceedAccuracyCheck();
  }

  function proceedAccuracyCheck() {
    if (updateLocation && isGpsAccuracyPoor(accuracyM)) {
      setConfirmState({
        open: true,
        message: `Akurasi GPS ${accuracyM?.toFixed(0)} m (lebih dari 50 m). Tetap simpan dengan akurasi ini?`,
        onConfirm: () => {
          setConfirmState({ open: false, message: "" });
          actuallySubmit();
        },
      });
      return;
    }
    actuallySubmit();
  }

  if (isLoading || !outlet) return <p className="text-sm text-slate-400">Memuat...</p>;

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-lg font-semibold text-slate-900">Kunjungan Ulang — {outlet.name}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Waktu Kunjungan</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="visitDate">Tanggal kunjungan *</Label>
                <Input id="visitDate" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="visitTime">Jam kunjungan *</Label>
                <Input id="visitTime" type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} required />
              </div>
            </div>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Catat penjualan HARI INI saja (hingga jam Anda sekarang), bukan total kumulatif.
            </p>
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
            <p className="text-xs text-slate-500">
              Merek dari kunjungan sebelumnya sudah dimuat — konfirmasi nilainya (boleh 0 bila tidak ada penjualan).
            </p>
            <SalesRowsEditor rows={sales} onChange={setSales} brandOptions={brandOptions ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Perbarui Info Warung</h2>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={updateLocation}
                  onChange={(e) => setUpdateLocation(e.target.checked)}
                />
                Perbarui koordinat
              </label>
            </div>
            {updateLocation && (
              <>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={geo.capture} disabled={geo.loading}>
                    {geo.loading ? "Mengambil lokasi..." : "📍 Ambil Lokasi"}
                  </Button>
                  {accuracyM != null && (
                    <span className={`text-xs ${accuracyM > 50 ? "text-amber-600" : "text-emerald-600"}`}>
                      Akurasi: {accuracyM.toFixed(0)} m
                    </span>
                  )}
                </div>
                <LocationPickerLazy
                  latitude={lat}
                  longitude={lng}
                  onChange={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Label htmlFor="visitNotes">Catatan kunjungan (opsional)</Label>
            <Textarea id="visitNotes" value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan Kunjungan Ulang"}
        </Button>
      </form>

      <ConfirmDialog
        open={confirmState.open}
        title="Konfirmasi"
        description={confirmState.message}
        onConfirm={() => confirmState.onConfirm?.()}
        onCancel={() => setConfirmState({ open: false, message: "" })}
      />
    </div>
  );
}
