"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getQueue, syncOne, type QueuedSubmission } from "@/lib/offline-db";
import { useOnlineSync } from "@/lib/use-online-sync";
import { useToast } from "@/components/ui/toast";

const statusVariant = {
  pending: "warning",
  syncing: "info",
  failed: "danger",
  synced: "success",
} as const;

const statusLabel = {
  pending: "Menunggu",
  syncing: "Sedang dikirim",
  failed: "Gagal",
  synced: "Berhasil",
};

export default function SinkronisasiPage() {
  const { isOnline, sync, isSyncing } = useOnlineSync();
  const { toast } = useToast();
  const [entries, setEntries] = React.useState<QueuedSubmission[]>([]);

  const refresh = React.useCallback(async () => {
    setEntries(await getQueue());
  }, []);

  React.useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function resendOne(entry: QueuedSubmission) {
    const result = await syncOne(entry);
    await refresh();
    if (result.ok) toast({ title: "Berhasil dikirim", kind: "success" });
    else toast({ title: "Gagal dikirim", description: result.error, kind: "error" });
  }

  async function resendAll() {
    await sync();
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Status Sinkronisasi</h1>
        <Badge variant={isOnline ? "success" : "warning"}>{isOnline ? "Online" : "Offline"}</Badge>
      </div>

      <Button className="w-full" onClick={resendAll} disabled={!isOnline || isSyncing}>
        {isSyncing ? "Mengirim..." : "Kirim Ulang Semua"}
      </Button>

      {entries.length === 0 && <p className="text-sm text-slate-400">Tidak ada antrean.</p>}

      <div className="space-y-2">
        {entries.map((e) => (
          <Card key={e.clientUuid}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {e.type === "new_outlet" ? "Warung baru" : "Kunjungan ulang"}
                </p>
                <p className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString("id-ID")}</p>
                {e.lastError && <p className="mt-1 text-xs text-red-600">{e.lastError}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[e.status]}>{statusLabel[e.status]}</Badge>
                {(e.status === "pending" || e.status === "failed") && (
                  <Button size="sm" variant="outline" onClick={() => resendOne(e)} disabled={!isOnline}>
                    Kirim Ulang
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
