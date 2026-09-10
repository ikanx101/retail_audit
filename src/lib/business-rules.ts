// Aturan validasi & bisnis — requirement.md bagian 11 (VL-01..VL-11).

/** Indonesia bounding box (kasar), dipakai untuk peringatan VL-04. */
export const INDONESIA_BBOX = {
  minLat: -11,
  maxLat: 6,
  minLng: 95,
  maxLng: 141,
};

export function isWithinIndonesiaBBox(lat: number, lng: number): boolean {
  return (
    lat >= INDONESIA_BBOX.minLat &&
    lat <= INDONESIA_BBOX.maxLat &&
    lng >= INDONESIA_BBOX.minLng &&
    lng <= INDONESIA_BBOX.maxLng
  );
}

export interface WeatherHours {
  clear: number;
  cloudy: number;
  drizzle: number;
  rain: number;
}

export function totalWeatherHours(w: WeatherHours): number {
  return w.clear + w.cloudy + w.drizzle + w.rain;
}

/** VL-01: total jam cuaca > 24 = error. */
export function isWeatherOverflow(w: WeatherHours): boolean {
  return totalWeatherHours(w) > 24;
}

/** VL-01: total jam cuaca < 24 = "belum lengkap" (boleh disimpan, hanya flag). */
export function isWeatherIncomplete(w: WeatherHours): boolean {
  return totalWeatherHours(w) < 24;
}

/** VL-02: sachets_sold > 5000 per merek memicu konfirmasi "angka tidak wajar". */
export function isSachetsUnusual(sachets: number): boolean {
  return sachets > 5000;
}

/** FR-45: total sachet semua merek dalam satu kunjungan > 500 memicu konfirmasi. */
export function isTotalSachetsLarge(rows: { sachets: number }[]): boolean {
  return rows.reduce((sum, r) => sum + r.sachets, 0) > 500;
}

/** VL-11: jam kunjungan di luar 04:00–23:00 memicu konfirmasi kemungkinan salah input. */
export function isVisitTimeUnusual(time: string): boolean {
  const [h] = time.split(":").map(Number);
  return h < 4 || h >= 23;
}

/** VL-05: tanggal kunjungan harus <= hari ini (WIB) dan >= 2026-01-01. */
export function isVisitDateValid(dateStr: string, todayStr: string): boolean {
  const MIN_DATE = "2026-01-01";
  return dateStr >= MIN_DATE && dateStr <= todayStr;
}

/** FR-16: peringatan lunak bila tanggal > 30 hari ke belakang dari hari ini. */
export function isDateTooFarInPast(dateStr: string, todayStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const today = new Date(`${todayStr}T00:00:00Z`);
  const diffDays = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 30;
}

/** VL-07: normalisasi nama merek untuk perbandingan duplikat (case-insensitive, trim). */
export function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** VL-07: cek duplikat merek dalam satu daftar baris kunjungan. */
export function hasDuplicateBrands(names: string[]): boolean {
  const normalized = names.map(normalizeBrandName);
  return new Set(normalized).size !== normalized.length;
}

/** FR-14: akurasi GPS > 50m harus menampilkan peringatan. */
export function isGpsAccuracyPoor(accuracyM: number | null | undefined): boolean {
  if (accuracyM == null) return false;
  return accuracyM > 50;
}
