// Semua waktu disimpan di database sebagai UTC (timestamptz / date),
// tapi ditampilkan & diinput dalam zona waktu Asia/Jakarta (WIB, UTC+7).
// Indonesia tidak menerapkan DST sehingga offset WIB selalu tetap +7 jam.

const WIB_OFFSET_MINUTES = 7 * 60;

/** Kembalikan tanggal hari ini di WIB dalam format YYYY-MM-DD. */
export function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MINUTES * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

/** Kembalikan jam:menit sekarang di WIB dalam format HH:mm. */
export function nowTimeWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MINUTES * 60 * 1000);
  return wib.toISOString().slice(11, 16);
}

/** Format tanggal (Date | string) menjadi DD/MM/YYYY dalam WIB. */
export function formatDateWIB(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Format tanggal + jam menjadi "DD/MM/YYYY HH:mm WIB". */
export function formatDateTimeWIB(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${formatted} WIB`;
}

/** Konversi string tanggal YYYY-MM-DD (dianggap WIB) menjadi Date UTC tengah malam WIB. */
export function dateOnlyToUTC(dateStr: string): Date {
  // Simpan sebagai UTC midnight dari tanggal kalender yang diinput (kolom DB bertipe date).
  return new Date(`${dateStr}T00:00:00.000Z`);
}
