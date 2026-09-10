"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createInterviewerSchema } from "@/lib/validations";

interface Interviewer {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  region: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  outletCount: number;
  visitCount: number;
}

export default function MasterInterviewerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState({ fullName: "", username: "", password: "", phone: "", region: "" });
  const [creating, setCreating] = React.useState(false);
  const [newPasswordDialog, setNewPasswordDialog] = React.useState<{ open: boolean; password: string }>({
    open: false,
    password: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["interviewers"],
    queryFn: async (): Promise<Interviewer[]> => {
      const res = await fetch("/api/interviewers");
      const json = await res.json();
      return json.data;
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createInterviewerSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Periksa kembali isian", description: parsed.error.issues[0]?.message, kind: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/interviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Gagal membuat akun", description: body?.error, kind: "error" });
        return;
      }
      toast({ title: "Akun interviewer dibuat", kind: "success" });
      setForm({ fullName: "", username: "", password: "", phone: "", region: "" });
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["interviewers"] });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(interviewer: Interviewer) {
    const res = await fetch(`/api/interviewers/${interviewer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !interviewer.isActive }),
    });
    if (res.ok) {
      toast({ title: interviewer.isActive ? "Akun dinonaktifkan" : "Akun diaktifkan", kind: "success" });
      queryClient.invalidateQueries({ queryKey: ["interviewers"] });
    }
  }

  async function resetPassword(interviewer: Interviewer) {
    const res = await fetch(`/api/interviewers/${interviewer.id}/reset-password`, { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      setNewPasswordDialog({ open: true, password: json.data.newPassword });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Kelola Interviewer</h1>
        <Button onClick={() => setShowCreate((s) => !s)}>{showCreate ? "Batal" : "+ Tambah Interviewer"}</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="fullName">Nama lengkap *</Label>
                <Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="username">Username *</Label>
                <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="password">Password awal *</Label>
                <Input id="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="phone">Nomor HP (opsional)</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="region">Wilayah tugas (opsional)</Label>
                <Input id="region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </div>
              <div className="flex items-end md:col-span-2">
                <Button type="submit" disabled={creating}>
                  {creating ? "Menyimpan..." : "Simpan Akun"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-slate-400">Memuat...</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Wilayah</th>
              <th className="px-3 py-2">Warung</th>
              <th className="px-3 py-2">Kunjungan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((i) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{i.fullName}</td>
                <td className="px-3 py-2">{i.username}</td>
                <td className="px-3 py-2">{i.region ?? "-"}</td>
                <td className="px-3 py-2">{i.outletCount}</td>
                <td className="px-3 py-2">{i.visitCount}</td>
                <td className="px-3 py-2">
                  <Badge variant={i.isActive ? "success" : "danger"}>{i.isActive ? "Aktif" : "Nonaktif"}</Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(i)}>
                      {i.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resetPassword(i)}>
                      Reset Password
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={newPasswordDialog.open}
        onClose={() => setNewPasswordDialog({ open: false, password: "" })}
        title="Password Baru"
        description="Salin dan sampaikan password ini ke interviewer. Password tidak dapat ditampilkan lagi setelah dialog ini ditutup."
      >
        <div className="rounded-lg bg-slate-100 p-3 text-center font-mono text-lg font-semibold text-slate-900">
          {newPasswordDialog.password}
        </div>
        <Button className="mt-4 w-full" onClick={() => setNewPasswordDialog({ open: false, password: "" })}>
          Tutup
        </Button>
      </Dialog>
    </div>
  );
}
