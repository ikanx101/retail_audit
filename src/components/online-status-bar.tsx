"use client";

import { usePathname } from "next/navigation";
import { useOnlineSync } from "@/lib/use-online-sync";
import { cn } from "@/lib/utils";

export function OnlineStatusBar() {
  const pathname = usePathname();
  const { isOnline, pendingCount, isSyncing } = useOnlineSync();

  if (pathname === "/login") return null;
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-50 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium",
        !isOnline ? "bg-amber-500 text-white" : "bg-blue-600 text-white"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", !isOnline ? "bg-white" : "bg-white animate-pulse")} />
      {!isOnline
        ? "Offline — data akan tersimpan lokal & tersinkron otomatis saat online"
        : isSyncing
          ? `Menyinkronkan ${pendingCount} data...`
          : `${pendingCount} data menunggu sinkronisasi`}
    </div>
  );
}
