import { z } from "zod";
import { isValidIndonesianPhone } from "./phone";
import { hasDuplicateBrands, normalizeBrandName } from "./business-rules";

// Sejak v1.5: total jam cuaca TIDAK wajib berjumlah/dibatasi 24 jam — interviewer bebas
// mengisi kondisi cuaca yang benar-benar teramati tanpa harus menutupi seluruh hari. Batas
// per-kondisi (0–24 jam masing-masing) tetap berlaku karena satu kondisi tidak mungkin lebih
// dari 24 jam dalam sehari.
export const weatherSchema = z.object({
  weatherClearH: z.coerce.number().int().min(0).max(24),
  weatherCloudyH: z.coerce.number().int().min(0).max(24),
  weatherDrizzleH: z.coerce.number().int().min(0).max(24),
  weatherRainH: z.coerce.number().int().min(0).max(24),
});

export const saleRowSchema = z.object({
  brandId: z.string().uuid().nullable().optional(),
  brandName: z.string().trim().min(1, "Nama merek wajib diisi"),
  sachetsSold: z.coerce.number().int().min(0, "Tidak boleh negatif").max(100000, "Maksimal 100.000"),
  variantNote: z.string().trim().optional().nullable(),
  isNewBrand: z.boolean().optional().default(false),
});

export const salesArraySchema = z
  .array(saleRowSchema)
  .min(1, "Minimal satu merek wajib diisi")
  .refine((rows) => !hasDuplicateBrands(rows.map((r) => r.brandName)), {
    message: "Terdapat merek duplikat dalam kunjungan ini.",
  });

export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidIndonesianPhone, { message: "Format nomor telepon Indonesia tidak valid (contoh: 0812xxxxxxx)." });

export const coordinateSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyM: z.coerce.number().min(0).nullable().optional(),
  geolocationSource: z.enum(["GPS", "MANUAL"]).default("GPS"),
});

export const visitTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam kunjungan HH:mm tidak valid");

export const newOutletVisitSchema = z
  .object({
    clientUuid: z.string().uuid(),
    // Outlet
    name: z.string().trim().min(2, "Nama warung wajib diisi"),
    ownerName: z.string().trim().min(2, "Nama pemilik wajib diisi"),
    address: z.string().trim().min(5, "Alamat wajib diisi"),
    phone: phoneSchema,
    city: z.string().trim().optional().nullable(),
    district: z.string().trim().optional().nullable(),
    openingTime: visitTimeSchema,
    closingTime: visitTimeSchema,
    outletNotes: z.string().trim().optional().nullable(),
    // Visit
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    visitTime: visitTimeSchema,
    visitNotes: z.string().trim().optional().nullable(),
    sales: salesArraySchema,
  })
  .and(weatherSchema)
  .and(coordinateSchema);

export type NewOutletVisitInput = z.infer<typeof newOutletVisitSchema>;

export const revisitSchema = z
  .object({
    outletId: z.string().uuid(),
    clientUuid: z.string().uuid(),
    confirmOverwriteVisitId: z.string().uuid().optional(),
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    visitTime: visitTimeSchema,
    visitNotes: z.string().trim().optional().nullable(),
    sales: salesArraySchema,
    // Koordinat opsional (hanya jika "Perbarui Info Warung" dipakai)
    updateLocation: z.boolean().optional().default(false),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    accuracyM: z.coerce.number().min(0).optional().nullable(),
  })
  .and(weatherSchema);

export type RevisitInput = z.infer<typeof revisitSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const createInterviewerSchema = z.object({
  fullName: z.string().trim().min(2, "Nama lengkap wajib diisi"),
  username: z.string().trim().min(3, "Username minimal 3 karakter").regex(/^[a-zA-Z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, dan strip"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
});

// FR-27 / kelola kualitas data: Master mengoreksi data warung yang diinput interviewer.
export const masterEditOutletSchema = z.object({
  name: z.string().trim().min(2, "Nama warung wajib diisi"),
  ownerName: z.string().trim().min(2, "Nama pemilik wajib diisi"),
  address: z.string().trim().min(5, "Alamat wajib diisi"),
  phone: phoneSchema,
  city: z.string().trim().optional().nullable(),
  district: z.string().trim().optional().nullable(),
  openingTime: visitTimeSchema.optional().nullable(),
  closingTime: visitTimeSchema.optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type MasterEditOutletInput = z.infer<typeof masterEditOutletSchema>;

// Master mengoreksi/menghapus baris kunjungan yang diinput interviewer.
export const masterEditVisitSchema = z
  .object({
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    visitTime: visitTimeSchema,
    notes: z.string().trim().optional().nullable(),
    sales: salesArraySchema,
  })
  .and(weatherSchema);

export type MasterEditVisitInput = z.infer<typeof masterEditVisitSchema>;

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Nama merek wajib diisi"),
  variant: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export { normalizeBrandName };
