"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { WeatherHoursEditor, type WeatherState } from "@/components/forms/weather-hours-editor";
import { revisitWeatherSchema } from "@/lib/validations";
import { todayWIB } from "@/lib/timezone";
import { saveDraft, loadDraft, clearDraft, enqueueSubmission } from "@/lib/offline-db";
import { parseDecimalInput } from "@/lib/utils";

interface OutletDetail {
  id: string;
  name: string;
}

// Kunjungan ke-2 dst — Formulir Cuaca (v2.5). Berdiri sendiri, terpisah dari formulir
// Merek & Penjualan (lihat /kunjungan/penjualan). Satu-satunya field yang sama di kedua
// formulir adalah tanggal kunjungan.
export default function KunjunganCuacaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const draftKey = `revisit_weather:${params.id}`;

  const { data: outlet, isLoading, isError } = useQuery({
    queryKey: ["outlet-basic", params.id],
    retry: false,
    queryFn: async (): Promise<OutletDetail> => {
      const res = await fetch(`/api/outlets/${params.id}`);
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json?.error ?? "Warung tidak ditemukan");
      return json.data;
    },
  });

  const [clientUuid] = React.useState(() => crypto.randomUUID());
  const [visitDate, setVisitDate] = React.useState(todayWIB());
  const [weather, setWeather] = React.useState<WeatherState>({
    weatherHotH: "0",
    weatherClearH: "0",
    weatherCloudyH: "0",
    weatherDrizzleH: "0",
    weatherRainH: "0",
  });
  const [confirmState, setConfirmState] = React.useState<{ open: boolean; message: string; onConfirm?: () => void }>({
    open: false,
    message: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const draftLoaded = React.useRef(false);

  React.useEffect(() => {
    if (!draftLoaded.current) {
      draftLoaded.current = true;
      loadDraft(draftKey).then((draft) => {
        if (!draft) return;
        const d = draft as Record<string, unknown>;
        setVisitDate((d.visitDate as string) ?? todayWIB());
        if (d.weather) setWeather(d.weather as WeatherState);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      saveDraft(draftKey, { visitDate, weather });
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitDate, weather]);

  function buildPayload(overwriteId?: string) {
    return {
      outletId: params.id,
      clientUuid,
      confirmOverwriteVisitId: overwriteId,
      visitDate,
      weatherHotH: parseDecimalInput(weather.weatherHotH || "0"),
      weatherClearH: parseDecimalInput(weather.weatherClearH || "0"),
      weatherCloudyH: parseDecimalInput(weather.weatherCloudyH || "0"),
      weatherDrizzleH: parseDecimalInput(weather.weatherDrizzleH || "0"),
      weatherRainH: parseDecimalInput(weather.weatherRainH || "0"),
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
        toast({ title: "Data cuaca tersimpan", kind: "success" });
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
    actuallySubmit();
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

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-lg font-semibold text-slate-900">Formulir Cuaca — {outlet.name}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Label htmlFor="visitDate">Tanggal kunjungan *</Label>
            <Input id="visitDate" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-700">Kondisi Cuaca (dalam jam)</h2>
            <WeatherHoursEditor value={weather} onChange={setWeather} />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan Data Cuaca"}
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
