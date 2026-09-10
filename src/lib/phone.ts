/**
 * Validasi & normalisasi nomor telepon Indonesia.
 * Menerima 08xx... atau +628xx... / 628xx..., panjang keseluruhan digit 9–15.
 * Disimpan dalam format ternormalisasi "+62xxxxxxxxxx".
 */

const PHONE_REGEX = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;

export function isValidIndonesianPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s-()]/g, "");
  if (!PHONE_REGEX.test(cleaned)) return false;
  const digits = cleaned.replace(/^\+/, "").replace(/^62/, "").replace(/^0/, "");
  return digits.length >= 8 && digits.length <= 13;
}

export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s-()]/g, "");
  let digits: string;
  if (cleaned.startsWith("+62")) digits = cleaned.slice(3);
  else if (cleaned.startsWith("62")) digits = cleaned.slice(2);
  else if (cleaned.startsWith("0")) digits = cleaned.slice(1);
  else digits = cleaned;
  return `+62${digits}`;
}
