"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { LocationPickerLazy } from "@/components/forms/location-picker-lazy";
import { masterEditOutletSchema } from "@/lib/validations";
import { formatDateWIB } from "@/lib/timezone";

interface VisitSale {
  brandNameSnapshot: string;
  sachetsSold: number;
}

interface Visit {
  id: string;
  visitNumber: number;
  visitDate: string;
  visitTime: string;
  weatherClearH: number;
  weatherCloudyH: number;
  weatherDrizzleH: number;
  weatherRainH: number;
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

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

export default function MasterWarungDetailPage() {
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
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const editLoaded = React.useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["outlet", params.id],
    retry: false,
    queryFn: async (): Promise<OutletDetail> => {
      const res = await fetch(`/api/outlets/${params.id}`);
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json?.error ?? "Warung tidak ditemukan");
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

  const chartData = React.useMemo(() => {
    if (!data) return [];
    const brandSet = new Set<string>();
    data.visits.forEach((v) => v.sales.forEach((s) => brandSet.add(s.brandNameSnapshot)));
    const brands = [...brandSet];

    return [...data.visits]
      .sort((a, b) => a.visitDate.localeCompare(b.visitDate))
      .map((v) => {
        const row: Record<string, string | number> = { tanggal: formatDateWIB(v.visitDate) };
        brands.forEach((b) => {
          row[b] = v.sales.find((s) => s.brandNameSnapshot === b)?.sachetsSold ?? 0;
        });
        return row;
      });
  }, [data]);

  const brandKeys = React.useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.visits.forEach((v) => v.sales.forEach((s) => set.add(s.brandNameSnapshot)));
    return [...set];
  }, [data]);

  async function handleSaveOutlet(e: React.FormEvent) {
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
        queryClient.invalidateQueries({ queryKey: ["outlet", params.id] });
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Gagal menyimpan", description: body?.error, kind: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVisit() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/master/visits/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Kunjungan dihapus", kind: "success" });
        queryClient.invalidateQueries({ queryKey: ["outlet", params.id] });
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Gagal menghapus", description: body?.error, kind: "error" });
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (isLoading) return <p className="text-sm text-slate-400">Memuat...</p>;
  if (isError || !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">Warung tidak ditemukan — mungkin tautannya tidak valid.</p>
        <Link href="/master/warungs" className="text-sm text-blue-600 underline">
          ← Kembali ke daftar warung
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between">
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
              {editing ? "Batal" : "Edit Info Warung"}
            </Button>
          </div>

          {editing && (
            <form onSubmit={handleSaveOutlet} className="space-y-3 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                <div className="md:col-span-2">
                  <Label htmlFor="e-address">Alamat</Label>
                  <Textarea
                    id="e-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="e-phone">Nomor telepon</Label>
                  <Input id="e-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="e-city">Kota</Label>
                  <Input id="e-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e-district">Kecamatan</Label>
                  <Input id="e-district" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="e-opening">Jam buka warung</Label>
                  <Input
                    id="e-opening"
                    type="time"
                    value={form.openingTime}
                    onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="e-closing">Jam tutup warung</Label>
                  <Input
                    id="e-closing"
                    type="time"
                    value={form.closingTime}
                    onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="e-notes">Catatan</Label>
                  <Textarea id="e-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Koordinat</Label>
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

              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tren Penjualan per Merek</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {brandKeys.map((b, i) => (
                <Line key={b} type="monotone" dataKey={b} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Riwayat Kunjungan</h2>
        <div className="space-y-2">
          {data.visits.map((v) => {
            const totalJam = v.weatherClearH + v.weatherCloudyH + v.weatherDrizzleH + v.weatherRainH;
            const totalSachet = v.sales.reduce((s, x) => s + x.sachetsSold, 0);
            return (
              <Card key={v.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">
                      Kunjungan #{v.visitNumber} — {formatDateWIB(v.visitDate)}
                    </p>
                    <Badge variant="info">{v.visitTime} WIB</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Total jam cuaca tercatat: {totalJam} jam · Sachet terjual hari itu (hingga jam kunjungan): {totalSachet}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.sales.map((s, i) => (
                      <Badge key={i} variant="default">
                        {s.brandNameSnapshot}: {s.sachetsSold}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/master/kunjungan/${v.id}`}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteTarget({ id: v.id, label: `#${v.visitNumber} — ${formatDateWIB(v.visitDate)}` })}
                    >
                      Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Hapus kunjungan ini?"
        description={
          deleteTarget
            ? `Kunjungan ${deleteTarget.label} akan disembunyikan dari dashboard, grafik, dan export (soft delete).`
            : ""
        }
        confirmLabel={deleting ? "Menghapus..." : "Ya, hapus"}
        danger
        onConfirm={handleDeleteVisit}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
