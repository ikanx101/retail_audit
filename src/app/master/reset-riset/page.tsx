"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

const CONFIRM_PHRASE = "RESET";

export default function ResetRisetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [phrase, setPhrase] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function closeDialog() {
    setOpen(false);
    setPassword("");
    setPhrase("");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/master/reset-riset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Gagal reset riset", description: body?.error ?? "Terjadi kesalahan", kind: "error" });
        return;
      }
      toast({
        title: "Semua data riset berhasil direset",
        description: `${body.data.outlets} warung, ${body.data.visits} kunjungan, ${body.data.interviewers} akun interviewer dihapus.`,
        kind: "success",
      });
      closeDialog();
      queryClient.invalidateQueries();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Reset Riset</h1>

      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Zona Berbahaya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-red-900">
          <p>
            Aksi ini akan menghapus <strong>seluruh</strong> data warung, kunjungan, penjualan, dan akun
            interviewer secara permanen — aplikasi akan kembali ke kondisi seperti baru pertama kali dijalankan.
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>Semua data warung yang terdaftar</li>
            <li>Semua data kunjungan (cuaca &amp; penjualan merek)</li>
            <li>Semua akun interviewer</li>
          </ul>
          <p className="font-medium">
            Tindakan ini tidak dapat dibatalkan. Akun Master tidak akan terhapus.
          </p>
          <Button variant="danger" onClick={() => setOpen(true)}>
            Reset Semua Data Riset
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={closeDialog}
        title="Konfirmasi Reset Riset"
        description="Aksi ini permanen. Masukkan password akun Master Anda dan ketik RESET untuk melanjutkan."
      >
        <form onSubmit={handleReset} className="space-y-3">
          <div>
            <Label htmlFor="reset-password">Password akun Master *</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="reset-phrase">Ketik &quot;{CONFIRM_PHRASE}&quot; untuk konfirmasi *</Label>
            <Input
              id="reset-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="danger"
              className="flex-1"
              disabled={submitting || phrase !== CONFIRM_PHRASE || password.length === 0}
            >
              {submitting ? "Mereset..." : "Ya, Reset Semua Data"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
