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
