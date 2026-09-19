"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { WeatherHoursEditor, type WeatherState } from "@/components/forms/weather-hours-editor";
import { revisitWeatherSchema } from "@/lib/validations";
import { todayWIB } from "@/lib/timezone";
import { saveDraft, loadDraft, clearDraft, enqueueSubmission } from "@/lib/offline-db";
import { parseDecimalInput } from "@/lib/utils";

interface OutletVisit {
  id: string;
  visitDate: string;
  weatherHotH: number | null;
  weatherClearH: number | null;
  weatherCloudyH: number | null;
  weatherDrizzleH: number | null;
  weatherRainH: number | null;
  notes: string | null;
}

interface OutletDetail {
  id: string;
  name: string;
  visits: OutletVisit[];
}

// Kunjungan ke-2 dst — Formulir Cuaca (v2.5). Berdiri sendiri, terpisah dari formulir
// Merek & Penjualan (lihat /kunjungan/penjualan). Satu-satunya field yang sama di kedua
// formulir adalah tanggal kunjungan.
export default function KunjunganCuacaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editVisitId = searchParams.get("visitId");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const draftKey = `revisit_weather:${params.id}`;

  const { data: outlet, isLoading, isError } = useQuery({
    // `editVisitId` disertakan di queryKey (v3.1) supaya data selalu diambil ulang dari
    // server saat masuk mode edit — mencegah form menampilkan cache lama (mis. dari
    // sebelum kunjungan ini terisi) akibat navigasi client-side antar halaman ini.
    queryKey: ["outlet-basic", params.id, editVisitId ?? "new"],
    retry: false,
    queryFn: async (): Promise<OutletDetail> => {
      const res = await fetch(`/api/outlets/${params.id}`);
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json?.error ?? "Warung tidak ditemukan");
      return json.data;
    },
  });

  const editTarget = React.useMemo(
    () => (editVisitId ? outlet?.visits.find((v) => v.id === editVisitId) ?? null : null),
    [outlet, editVisitId]
  );
  const isEditMode = Boolean(editVisitId);

  const [clientUuid] = React.useState(() => crypto.randomUUID());
  const [visitDate, setVisitDate] = React.useState(todayWIB());
  const [weather, setWeather] = React.useState<WeatherState>({
    weatherHotH: "0",
    weatherClearH: "0",
    weatherCloudyH: "0",
    weatherDrizzleH: "0",
    weatherRainH: "0",
  });
  const [notes, setNotes] = React.useState("");
  const [confirmState, setConfirmState] = React.useState<{ open: boolean; message: string; onConfirm?: () => void }>({
    open: false,
    message: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const draftLoaded = React.useRef(false);
  const editLoaded = React.useRef(false);

  // Mode edit (v3.1): prefill dari kunjungan yang sudah tersimpan, bukan dari draft lokal.
  React.useEffect(() => {
    if (isEditMode && editTarget && !editLoaded.current) {
      editLoaded.current = true;
      setVisitDate(editTarget.visitDate.slice(0, 10));
      setWeather({
        weatherHotH: String(editTarget.weatherHotH ?? 0),
        weatherClearH: String(editTarget.weatherClearH ?? 0),
        weatherCloudyH: String(editTarget.weatherCloudyH ?? 0),
        weatherDrizzleH: String(editTarget.weatherDrizzleH ?? 0),
        weatherRainH: String(editTarget.weatherRainH ?? 0),
      });
      setNotes(editTarget.notes ?? "");
    }
  }, [isEditMode, editTarget]);

  // Sejak v4.0: bila belum ada draft lokal, catatan/komentar diambil dari kunjungan yang
  // sudah ada untuk tanggal yang sama (mis. sudah diisi lewat formulir penjualan lebih dulu)
  // supaya tidak tertimpa kosong — `notes` adalah satu kolom yang dipakai bersama kedua
  // formulir independen ini (lihat catatan pada model Visit).
  React.useEffect(() => {
    if (isEditMode) return;
    if (draftLoaded.current || !outlet) return;
    draftLoaded.current = true;
    loadDraft(draftKey).then((draft) => {
      const d = (draft ?? {}) as Record<string, unknown>;
      const dVisitDate = (d.visitDate as string) ?? todayWIB();
      setVisitDate(dVisitDate);
      if (d.weather) setWeather(d.weather as WeatherState);
      if (typeof d.notes === "string" && d.notes.length > 0) {
        setNotes(d.notes);
      } else {
        const sameDateVisit = outlet.visits.find((v) => v.visitDate.slice(0, 10) === dVisitDate);
        setNotes(sameDateVisit?.notes ?? "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, outlet]);

  React.useEffect(() => {
    if (isEditMode) return;
    const timeout = setTimeout(() => {
      saveDraft(draftKey, { visitDate, weather, notes });
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, visitDate, weather, notes]);

  function buildPayload(overwriteId?: string) {
    return {
      outletId: params.id,
      clientUuid,
      confirmOverwriteVisitId: overwriteId ?? editTarget?.id,
      visitDate,
      weatherHotH: parseDecimalInput(weather.weatherHotH || "0"),
      weatherClearH: parseDecimalInput(weather.weatherClearH || "0"),
      weatherCloudyH: parseDecimalInput(weather.weatherCloudyH || "0"),
      weatherDrizzleH: parseDecimalInput(weather.weatherDrizzleH || "0"),
      weatherRainH: parseDecimalInput(weather.weatherRainH || "0"),
      visitNotes: notes || null,
    };
  }

  async function actuallySubmit(overwriteId?: string) {
    const payload = buildPayload(overwriteId);
    setSubmitting(true);
    try {
      const res = await fetch("/api/visits/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await clearDraft(draftKey);
        toast({ title: isEditMode ? "Perubahan data cuaca tersimpan" : "Data cuaca tersimpan", kind: "success" });
        await queryClient.invalidateQueries({ queryKey: ["outlet", params.id] });
        await queryClient.invalidateQueries({ queryKey: ["outlets", "mine"] });
        router.push(`/interviewer/warung/${params.id}`);
        return;
      }
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "DUPLICATE_WEATHER" && body?.existingVisitId) {
          setConfirmState({
            open: true,
            message: "Sudah ada data cuaca pada tanggal ini untuk warung ini. Perbarui data yang ada?",
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
      await enqueueSubmission(clientUuid, "revisit_weather", payload);
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
    const parsed = revisitWeatherSchema.safeParse(payload);
    if (!parsed.success) {
      toast({ title: "Periksa kembali isian Anda", description: parsed.error.issues[0]?.message, kind: "error" });
      return;
    }
    setConfirmState({
      open: true,
      message: "Apakah Anda yakin data cuaca yang dimasukkan sudah benar?",
      onConfirm: () => {
        setConfirmState({ open: false, message: "" });
        actuallySubmit();
      },
    });
  }

  if (isLoading) return <p className="text-sm text-slate-400">Memuat...</p>;
  if (isError || !outlet) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">Warung tidak ditemukan — mungkin tautannya tidak valid.</p>
        <Link href="/interviewer/pilih-warung" className="text-sm text-blue-600 underline">
          ← Kembali ke daftar warung
        </Link>
      </div>
    );
  }

  if (isEditMode && !editTarget) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">Kunjungan yang ingin diedit tidak ditemukan.</p>
        <Link href={`/interviewer/warung/${params.id}`} className="text-sm text-blue-600 underline">
          ← Kembali ke detail warung
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-lg font-semibold text-slate-900">
        {isEditMode ? "Edit Data Cuaca" : "Formulir Cuaca"} — {outlet.name}
      </h1>
      {isEditMode && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Anda sedang mengedit data cuaca kunjungan tanggal {visitDate}. Tanggal kunjungan tidak
          bisa diubah dari sini.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Label htmlFor="visitDate">Tanggal kunjungan *</Label>
            <Input
              id="visitDate"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={isEditMode}
              required
            />
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
            <Label htmlFor="notes">Catatan / komentar (opsional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Menyimpan..." : isEditMode ? "Simpan Perubahan" : "Simpan Data Cuaca"}
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
