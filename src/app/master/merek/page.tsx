"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface Brand {
  id: string;
  name: string;
  variant: string | null;
  category: string | null;
  isActive: boolean;
}

export default function MasterMerekPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({ name: "", variant: "", category: "" });
  const [creating, setCreating] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["brands", "all"],
    queryFn: async (): Promise<Brand[]> => {
      const res = await fetch("/api/brands?all=1");
      const json = await res.json();
      return json.data;
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, variant: form.variant || null, category: form.category || null, isActive: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Gagal menambah merek", description: body?.error, kind: "error" });
        return;
      }
      toast({ title: "Merek ditambahkan", kind: "success" });
      setForm({ name: "", variant: "", category: "" });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(brand: Brand) {
    const res = await fetch(`/api/brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !brand.isActive }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Master Daftar Merek</h1>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label htmlFor="name">Nama merek *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="variant">Varian</Label>
              <Input id="variant" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="category">Kategori</Label>
              <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? "Menyimpan..." : "Tambah Merek"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((b) => (
          <Card key={b.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium text-slate-900">{b.name}</p>
                <p className="text-xs text-slate-500">{[b.category, b.variant].filter(Boolean).join(" · ") || "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={b.isActive ? "success" : "default"}>{b.isActive ? "Aktif" : "Nonaktif"}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleActive(b)}>
                  {b.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
