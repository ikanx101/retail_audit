import Dexie, { type EntityTable } from "dexie";

export type SubmissionType = "new_outlet" | "revisit";
export type SyncStatus = "pending" | "syncing" | "failed" | "synced";

export interface QueuedSubmission {
  clientUuid: string;
  type: SubmissionType;
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  syncedAt?: number;
}

export interface DraftEntry {
  key: string; // mis. "new_outlet" atau "revisit:<outletId>"
  data: Record<string, unknown>;
  updatedAt: number;
}

const offlineDb = new Dexie("RetailAuditDB") as Dexie & {
  queue: EntityTable<QueuedSubmission, "clientUuid">;
  drafts: EntityTable<DraftEntry, "key">;
};

offlineDb.version(1).stores({
  queue: "clientUuid, status, type, createdAt",
  drafts: "key, updatedAt",
});

export { offlineDb };

// ---- Draft autosave (FR-37) ----

export async function saveDraft(key: string, data: Record<string, unknown>) {
  try {
    await offlineDb.drafts.put({ key, data, updatedAt: Date.now() });
  } catch {
    // IndexedDB tidak tersedia (mis. private mode) — abaikan, form tetap berfungsi.
  }
}

export async function loadDraft(key: string): Promise<Record<string, unknown> | null> {
  try {
    const entry = await offlineDb.drafts.get(key);
    return entry?.data ?? null;
  } catch {
    return null;
  }
}

export async function clearDraft(key: string) {
  try {
    await offlineDb.drafts.delete(key);
  } catch {
    // no-op
  }
}

// ---- Submission queue (FR-38..FR-42) ----

export async function enqueueSubmission(
  clientUuid: string,
  type: SubmissionType,
  payload: Record<string, unknown>
) {
  await offlineDb.queue.put({
    clientUuid,
    type,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
  });
}

export async function getQueue(): Promise<QueuedSubmission[]> {
  try {
    return await offlineDb.queue.orderBy("createdAt").reverse().toArray();
  } catch {
    return [];
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    return await offlineDb.queue.where("status").anyOf(["pending", "failed"]).count();
  } catch {
    return 0;
  }
}

export async function markSyncing(clientUuid: string) {
  await offlineDb.queue.update(clientUuid, { status: "syncing" });
}

export async function markSynced(clientUuid: string) {
  await offlineDb.queue.update(clientUuid, { status: "synced", syncedAt: Date.now() });
}

export async function markFailed(clientUuid: string, error: string) {
  const existing = await offlineDb.queue.get(clientUuid);
  await offlineDb.queue.update(clientUuid, {
    status: "failed",
    lastError: error,
    attempts: (existing?.attempts ?? 0) + 1,
  });
}

/** FR-42: bersihkan entri sukses yang lebih lama dari 30 hari. */
export async function pruneSyncedOlderThan30Days() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  try {
    await offlineDb.queue.where("status").equals("synced").and((e: QueuedSubmission) => (e.syncedAt ?? 0) < cutoff).delete();
  } catch {
    // no-op
  }
}

const endpointByType: Record<SubmissionType, string> = {
  new_outlet: "/api/outlets",
  revisit: "/api/visits",
};

/** FR-39/FR-40: kirim satu entri antrean ke server, idempotent via client_uuid. */
export async function syncOne(entry: QueuedSubmission): Promise<{ ok: boolean; error?: string }> {
  await markSyncing(entry.clientUuid);
  try {
    const res = await fetch(endpointByType[entry.type], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry.payload),
    });
    if (res.ok || res.status === 409) {
      // 409 = sudah tersinkron sebelumnya (idempotent), anggap sukses.
      await markSynced(entry.clientUuid);
      return { ok: true };
    }
    const body = await res.json().catch(() => ({}));
    const message = body?.error ?? `Gagal (status ${res.status})`;
    await markFailed(entry.clientUuid, message);
    return { ok: false, error: message };
  } catch {
    await markFailed(entry.clientUuid, "Tidak ada koneksi internet");
    return { ok: false, error: "Tidak ada koneksi internet" };
  }
}

/** Sinkronisasi semua entri pending/failed. Dipanggil saat online & saat app dibuka. */
export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  const all = await getQueue();
  const toSync = all.filter((e) => e.status === "pending" || e.status === "failed");
  let synced = 0;
  let failed = 0;
  for (const entry of toSync) {
    const result = await syncOne(entry);
    if (result.ok) synced++;
    else failed++;
  }
  return { synced, failed };
}
