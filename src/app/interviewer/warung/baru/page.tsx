"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { LocationPickerLazy } from "@/components/forms/location-picker-lazy";
import { TimeInput24 } from "@/components/forms/time-input-24";
import { useGeolocation } from "@/lib/use-geolocation";
import { outletRegistrationSchema } from "@/lib/validations";
import { isGpsAccuracyPoor } from "@/lib/business-rules";
import { todayWIB } from "@/lib/timezone";
import { saveDraft, loadDraft, clearDraft, enqueueSubmission } from "@/lib/offline-db";

const DRAFT_KEY = "new_outlet";
const DEFAULT_LAT = -6.2088; // Jakarta, dipakai sebelum lokasi diambil
const DEFAULT_LNG = 106.8456;

interface ScalarFields {
  name: string;
  ownerName: string;
  address: string;
  phone: string;
  city: string;
  district: string;
  openingTime: string;
  closingTime: string;
  outletNotes: string;
  visitDate: string;
}

// Kunjungan pertama (v2.5): HANYA mendata warung — tidak ada pertanyaan cuaca maupun
// merek/sachet di sini. Itu baru muncul mulai kunjungan ke-2 lewat dua formulir terpisah.
export default function WarungBaruPage() {
  const router = useRouter();
  const { toast } = useToast();
  const geo = useGeolocation();

  const [clientUuid] = React.useState(() => crypto.randomUUID());
  const [lat, setLat] = React.useState(DEFAULT_LAT);
  const [lng, setLng] = React.useState(DEFAULT_LNG);
  const [accuracyM, setAccuracyM] = React.useState<number | null>(null);
  const [geoSource, setGeoSource] = React.useState<"GPS" | "MANUAL">("MANUAL");
  const [confirmState, setConfirmState] = React.useState<{ open: boolean; message: string; onConfirm?: () => void }>({
    open: false,
    message: "",
  });
  const [submitting, setSubmitting] = React.useState(false);

  const { register, handleSubmit, watch, reset, getValues, setValue } = useForm<ScalarFields>({
    defaultValues: {
      name: "",
      ownerName: "",
      address: "",
      phone: "",
      city: "",
      district: "",
      openingTime: "",
      closingTime: "",
      outletNotes: "",
      visitDate: todayWIB(),
    },
  });

  // Autosave draft (FR-37)
  const watched = watch();
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraft(DRAFT_KEY, { ...watched, lat, lng, accuracyM, geoSource });
    }, 500);
    return () => clearTimeout(timeout);
  }, [watched, lat, lng, accuracyM, geoSource]);

  React.useEffect(() => {
    loadDraft(DRAFT_KEY).then((draft) => {
      if (!draft) return;
      const d = draft as Record<string, unknown>;
      reset({
        name: (d.name as string) ?? "",
        ownerName: (d.ownerName as string) ?? "",
        address: (d.address as string) ?? "",
        phone: (d.phone as string) ?? "",
        city: (d.city as string) ?? "",
        district: (d.district as string) ?? "",
        openingTime: (d.openingTime as string) ?? "",
        closingTime: (d.closingTime as string) ?? "",
        outletNotes: (d.outletNotes as string) ?? "",
        visitDate: (d.visitDate as string) ?? todayWIB(),
      });
      if (typeof d.lat === "number") setLat(d.lat);
      if (typeof d.lng === "number") setLng(d.lng);
      if (typeof d.accuracyM === "number") setAccuracyM(d.accuracyM);
      if (d.geoSource) setGeoSource(d.geoSource as "GPS" | "MANUAL");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (geo.result) {
      setLat(geo.result.latitude);
      setLng(geo.result.longitude);
      setAccuracyM(geo.result.accuracy);
      setGeoSource("GPS");
    }
  }, [geo.result]);

  function buildPayload() {
    const scalars = getValues();
    return {
      clientUuid,
      name: scalars.name,
      ownerName: scalars.ownerName,
      address: scalars.address,
      phone: scalars.phone,
      city: scalars.city || null,
      district: scalars.district || null,
      openingTime: scalars.openingTime,
      closingTime: scalars.closingTime,
      outletNotes: scalars.outletNotes || null,
      visitDate: scalars.visitDate,
      latitude: lat,
      longitude: lng,
      accuracyM: accuracyM,
      geolocationSource: geoSource,
    };
  }

  async function actuallySubmit() {
    const payload = buildPayload();
    setSubmitting(true);
    try {
      const res = await fetch("/api/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await clearDraft(DRAFT_KEY);
        toast({ title: "Warung tersimpan", kind: "success" });
        router.push(`/interviewer/warung/baru/sukses?nama=${encodeURIComponent(payload.name)}`);
        return;
      }
      const body = await res.json().catch(() => ({}));
      toast({ title: "Gagal menyimpan", description: body?.error ?? "Terjadi kesalahan", kind: "error" });
    } catch {
      // Offline atau gagal jaringan — masukkan ke antrean lokal (FR-38)
      await enqueueSubmission(clientUuid, "new_outlet", payload);
      await clearDraft(DRAFT_KEY);
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

  const onSubmit = handleSubmit(() => {
    const payload = buildPayload();
    const parsed = outletRegistrationSchema.safeParse(payload);
    if (!parsed.success) {
      toast({
        title: "Periksa kembali isian Anda",
        description: parsed.error.issues[0]?.message,
        kind: "error",
      });
      return;
    }

    setConfirmState({
      open: true,
      message: "Apakah Anda yakin data warung yang dimasukkan sudah benar?",
      onConfirm: () => {
        setConfirmState({ open: false, message: "" });
        checkAccuracy();
      },
    });
  });

  function checkAccuracy() {
    if (geoSource === "GPS" && isGpsAccuracyPoor(accuracyM)) {
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

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-lg font-semibold text-slate-900">Warung Baru — Kunjungan Pertama</h1>
      <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
        Kunjungan pertama hanya mendata warung. Data cuaca & merek/sachet baru diisi mulai
        kunjungan ke-2 lewat menu &ldquo;Kunjungan Ulang&rdquo;.
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Data Warung</h2>
            <div>
              <Label htmlFor="name">Nama warung *</Label>
              <Input id="name" {...register("name", { required: true })} />
            </div>
            <div>
              <Label htmlFor="ownerName">Nama pemilik *</Label>
              <Input id="ownerName" {...register("ownerName", { required: true })} />
            </div>
            <div>
              <Label htmlFor="address">Alamat *</Label>
              <Textarea id="address" {...register("address", { required: true })} />
            </div>
            <div>
              <Label htmlFor="phone">Nomor telepon pemilik *</Label>
              <Input id="phone" inputMode="tel" placeholder="Nomor telepon" {...register("phone", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="city">Kota (opsional)</Label>
                <Input id="city" {...register("city")} />
              </div>
              <div>
                <Label htmlFor="district">Kecamatan (opsional)</Label>
                <Input id="district" {...register("district")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="openingTime">Jam buka warung *</Label>
                <TimeInput24
                  id="openingTime"
                  value={watch("openingTime")}
                  onChange={(v) => setValue("openingTime", v, { shouldDirty: true })}
                />
              </div>
              <div>
                <Label htmlFor="closingTime">Jam tutup warung *</Label>
                <TimeInput24
                  id="closingTime"
                  value={watch("closingTime")}
                  onChange={(v) => setValue("closingTime", v, { shouldDirty: true })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="outletNotes">Catatan warung (opsional)</Label>
              <Textarea id="outletNotes" {...register("outletNotes")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Lokasi</h2>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={geo.capture} disabled={geo.loading}>
                {geo.loading ? "Mengambil lokasi..." : "📍 Ambil Lokasi"}
              </Button>
              {accuracyM != null && (
                <span className={`text-xs ${accuracyM > 50 ? "text-amber-600" : "text-emerald-600"}`}>
                  Akurasi: {accuracyM.toFixed(0)} m {accuracyM > 50 && "(kurang akurat, ulangi jika bisa)"}
                </span>
              )}
            </div>
            {geo.errorMsg && <p className="text-xs text-red-600">{geo.errorMsg}</p>}

            <LocationPickerLazy
              latitude={lat}
              longitude={lng}
              onChange={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
                setGeoSource("MANUAL");
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => {
                    setLat(Number(e.target.value));
                    setGeoSource("MANUAL");
                  }}
                />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => {
                    setLng(Number(e.target.value));
                    setGeoSource("MANUAL");
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Geser pin di peta atau ketuk lokasi baru untuk mengoreksi posisi secara manual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Tanggal Registrasi</h2>
            <div>
              <Label htmlFor="visitDate">Tanggal kunjungan *</Label>
              <Input id="visitDate" type="date" {...register("visitDate", { required: true })} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan Warung"}
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
