"use client";

import * as React from "react";
import { getPendingCount, syncAllPending, pruneSyncedOlderThan30Days } from "@/lib/offline-db";

export function useOnlineSync() {
  const [isOnline, setIsOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const refreshPendingCount = React.useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const sync = React.useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncAllPending();
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  React.useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshPendingCount();
    pruneSyncedOlderThan30Days();

    const handleOnline = () => {
      setIsOnline(true);
      sync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Coba sinkron saat app dibuka (FR-39)
    if (navigator.onLine) sync();

    const interval = setInterval(refreshPendingCount, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isOnline, pendingCount, isSyncing, sync, refreshPendingCount };
}
