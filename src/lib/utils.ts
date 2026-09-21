import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mengonversi input angka bebas format (mis. "1,5" ataupun "1.5") ke number. */
export function parseDecimalInput(value: string): number {
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Membulatkan ke 2 desimal — menghindari sisa floating-point (mis. 0.1 + 0.2). */
export function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Ukuran byte hasil decode base64, dihitung tanpa Buffer (dipakai juga di validasi Zod yang
 * jalan di browser — lihat photosArraySchema di validations.ts) — string base64 diasumsikan
 * sudah bersih (tanpa prefix "data:...;base64," maupun whitespace).
 */
export function base64ByteLength(base64: string): number {
  const len = base64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (base64.endsWith("==")) padding = 2;
  else if (base64.endsWith("=")) padding = 1;
  return Math.floor((len * 3) / 4) - padding;
}
