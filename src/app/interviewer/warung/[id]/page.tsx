"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonClassNames } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { LocationPickerLazy } from "@/components/forms/location-picker-lazy";
import { TimeInput24 } from "@/components/forms/time-input-24";
import { masterEditOutletSchema } from "@/lib/validations";
import { formatDateWIB } from "@/lib/timezone";
import { roundHours } from "@/lib/utils";

interface VisitSale {
  brandNameSnapshot: string;
  sachetsSold: number;
}

interface Visit {
  id: string;
  visitNumber: number;
  visitDate: string;
  visitTime: string | null;
  weatherHotH: number | null;
  weatherClearH: number | null;
  weatherCloudyH: number | null;
  weatherDrizzleH: number | null;
  weatherRainH: number | null;
  weatherFilled: boolean;
  salesFilled: boolean;
  sales: VisitSale[];
}

interface OutletDetail {
  id: string;
  name: string;
  ownerName: string;
  address: string;
  phone: string;
  city: string | null;
  district: string | null;
  openingTime: string | null;
  closingTime: string | null;
  notes: string | null;
  latitude: string;
  longitude: string;
  visits: Visit[];
}

export default function WarungDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    ownerName: "",
    address: "",
    phone: "",
    city: "",
    district: "",
    openingTime: "",
    closingTime: "",
    notes: "",
  });
  const [lat, setLat] = React.useState(0);
  const [lng, setLng] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const editLoaded = React.useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["outlet", params.id],
    queryFn: async (): Promise<OutletDetail> => {
      const res = await fetch(`/api/outlets/${params.id}`);
      const json = await res.json();
      return json.data;
    },
  });

  React.useEffect(() => {
    if (data && !editLoaded.current) {
      editLoaded.current = true;
      setForm({
        name: data.name,
        ownerName: data.ownerName,
        address: data.address,
        phone: data.phone,
        city: data.city ?? "",
        district: data.district ?? "",
        openingTime: data.openingTime ?? "",
        closingTime: data.closingTime ?? "",
        notes: data.notes ?? "",
      });
      setLat(Number(data.latitude));
      setLng(Number(data.longitude));
    }
  }, [data]);

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      openingTime: form.openingTime || null,
      closingTime: form.closingTime || null,
      latitude: lat,
      longitude: lng,
    };
    const parsed = masterEditOutletSchema.safeParse(payload);
    if (!parsed.success) {
      toast({ title: "Periksa kembali isian", description: parsed.error.issues[0]?.message, kind: "error" });
      return;
    }
    setConfirmSave(true);
  }

  async function actuallySaveOutlet() {
    setConfirmSave(false);
    const payload = {
      ...form,
      openingTime: form.openingTime || null,
      closingTime: form.closingTime || null,
      latitude: lat,
      longitude: lng,
    };
    const parsed = masterEditOutletSchema.safeParse(payload);
    if (!parsed.success) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/outlets/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        toast({ title: "Info warung diperbarui", kind: "success" });
        setEditing(false);
        await queryClient.invalidateQueries({ queryKey: ["outlet", params.id] });
        await queryClient.invalidateQueries({ queryKey: ["outlets", "mine"] });
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Gagal menyimpan", description: body?.error, kind: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-slate-400">Memuat...</p>;
  if (!data) return <p className="text-sm text-red-600">Warung tidak ditemukan.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{data.name}</h1>
              <p className="text-sm text-slate-500">{data.address}</p>
              <p className="mt-1 text-xs text-slate-400">
                Pemilik: {data.ownerName} · {data.phone}
              </p>
              {(data.openingTime || data.closingTime) && (
                <p className="mt-1 text-xs text-slate-400">
                  Jam operasional: {data.openingTime ?? "-"} – {data.closingTime ?? "-"}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing((s) => !s)}>
              {editing ? "Batal" : "✏️ Edit"}
            </Button>
          </div>

          {editing && (
            <form onSubmit={handleEditSubmit} className="space-y-3 border-t border-slate-100 pt-3">
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Perbaiki data warung yang sudah pernah Anda input (mis. salah ketik atau lokasi
                kurang tepat). Perubahan berlaku untuk semua kunjungan di warung ini.
              </p>
              <div>
                <Label htmlFor="e-name">Nama warung</Label>
                <Input id="e-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="e-owner">Nama pemilik</Label>
                <Input
                  id="e-owner"
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="e-address">Alamat</Label>
                <Textarea
                  id="e-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="e-phone">Nomor telepon pemilik</Label>
                <Input id="e-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="e-city">Kota (opsional)</Label>
                  <Input id="e-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e-district">Kecamatan (opsional)</Label>
                  <Input id="e-district" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="e-opening">Jam buka warung</Label>
                  <TimeInput24
                    id="e-opening"
                    value={form.openingTime}
                    onChange={(v) => setForm({ ...form, openingTime: v })}
                  />
                </div>
                <div>
                  <Label htmlFor="e-closing">Jam tutup warung</Label>
                  <TimeInput24
                    id="e-closing"
                    value={form.closingTime}
                    onChange={(v) => setForm({ ...form, closingTime: v })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="e-notes">Catatan warung (opsional)</Label>
                <Textarea id="e-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div>
                <Label>Lokasi</Label>
                <LocationPickerLazy
                  latitude={lat}
                  longitude={lng}
                  onChange={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input type="number" step="0.000001" value={lat} onChange={(e) => setLat(Number(e.target.value))} />
                  <Input type="number" step="0.000001" value={lng} onChange={(e) => setLng(Number(e.target.value))} />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/interviewer/warung/${data.id}/kunjungan/cuaca`}
          className={buttonClassNames({ size: "lg", className: "w-full" })}
        >
          🌦️ Isi Data Cuaca
        </Link>
        <Link
          href={`/interviewer/warung/${data.id}/kunjungan/penjualan`}
          className={buttonClassNames({ size: "lg", variant: "outline", className: "w-full" })}
        >
          🥤 Isi Data Penjualan
        </Link>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Riwayat Kunjungan</h2>
        <div className="space-y-2">
          {data.visits.map((v) => {
            const totalJam =
              v.weatherClearH != null
                ? roundHours(
                    (v.weatherHotH ?? 0) + v.weatherClearH + (v.weatherCloudyH ?? 0) + (v.weatherDrizzleH ?? 0) + (v.weatherRainH ?? 0)
                  )
                : null;
            const totalSachet = v.sales.reduce((s, x) => s + x.sachetsSold, 0);
            // Kunjungan #1 (registrasi) hanya tampil sebagai "registrasi tanpa data" jika
            // memang belum ada cuaca/penjualan — jika interviewer mengisi formulir cuaca/
            // penjualan di hari yang sama, backend menyatukannya ke kunjungan #1 ini
            // (satu visit per outlet per tanggal), jadi datanya tetap harus ditampilkan.
            const isEmptyFirstVisit = v.visitNumber === 1 && !v.weatherFilled && !v.salesFilled;
            return (
              <Card key={v.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">
                      Kunjungan #{v.visitNumber} — {formatDateWIB(v.visitDate)}
                    </p>
                    {v.visitTime && <Badge variant="info">{v.visitTime} WIB</Badge>}
                  </div>
                  {isEmptyFirstVisit ? (
                    <p className="mt-1 text-xs text-slate-400">Registrasi warung (tanpa data cuaca/penjualan).</p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs text-slate-500">
                        {v.weatherFilled
                          ? `Total jam cuaca tercatat: ${totalJam} jam`
                          : "Cuaca belum diisi"}
                        {" · "}
                        {v.salesFilled
                          ? `Sachet terjual hari itu (hingga jam kunjungan): ${totalSachet}`
                          : "Penjualan belum diisi"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {!v.weatherFilled && <Badge variant="warning">Cuaca belum diisi</Badge>}
                        {!v.salesFilled && <Badge variant="warning">Penjualan belum diisi</Badge>}
                        {v.sales.map((s, i) => (
                          <Badge key={i} variant="default">
                            {s.brandNameSnapshot}: {s.sachetsSold}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {v.weatherFilled && (
                          <Link
                            href={`/interviewer/warung/${data.id}/kunjungan/cuaca?visitId=${v.id}`}
                            className={buttonClassNames({ size: "sm", variant: "outline" })}
                          >
                            ✏️ Edit Cuaca
                          </Link>
                        )}
                        {v.salesFilled && (
                          <Link
                            href={`/interviewer/warung/${data.id}/kunjungan/penjualan?visitId=${v.id}`}
                            className={buttonClassNames({ size: "sm", variant: "outline" })}
                          >
                            ✏️ Edit Penjualan
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSave}
        title="Konfirmasi Perubahan"
        description="Apakah Anda yakin data warung yang dimasukkan sudah benar?"
        confirmLabel="Ya, simpan"
        cancelLabel="Tidak, periksa lagi"
        onConfirm={actuallySaveOutlet}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}
