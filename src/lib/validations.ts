import { z } from "zod";
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

// Sejak v2.5: formulir penjualan merek berdiri sendiri (terpisah dari formulir cuaca), sehingga
// baris merek boleh kosong di skema dasar ini (mis. dipakai Master saat kunjungan itu baru
// terisi cuacanya saja). Formulir penjualan interviewer tetap mewajibkan minimal satu merek
// lewat `salesArraySchemaRequired` di bawah.
export const salesArraySchema = z
  .array(saleRowSchema)
  .refine((rows) => !hasDuplicateBrands(rows.map((r) => r.brandName)), {
    message: "Terdapat merek duplikat dalam kunjungan ini.",
  });

export const salesArraySchemaRequired = salesArraySchema.refine((rows) => rows.length >= 1, {
  message: "Minimal satu merek wajib diisi",
});

// Sejak v2.5: nomor telepon diisi bebas oleh interviewer — tidak lagi divalidasi mengikuti
// format Indonesia (VL-03 lama), hanya wajib diisi (tidak boleh kosong).
export const phoneSchema = z.string().trim().min(1, "Nomor telepon wajib diisi");

export const coordinateSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyM: z.coerce.number().min(0).nullable().optional(),
  geolocationSource: z.enum(["GPS", "MANUAL"]).default("GPS"),
});

export const visitTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam kunjungan HH:mm tidak valid");

// Sejak v2.5: kunjungan pertama HANYA mendata warung (registrasi) — tidak ada pertanyaan
// cuaca maupun merek/sachet (itu baru muncul mulai kunjungan ke-2, lewat dua formulir terpisah
// di bawah). `visitDate` tetap dicatat sebagai tanggal registrasi warung.
export const outletRegistrationSchema = z
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
    // Kunjungan pertama (registrasi)
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  })
  .and(coordinateSchema);

export type OutletRegistrationInput = z.infer<typeof outletRegistrationSchema>;

// Kunjungan ke-2 dst — Formulir Cuaca (berdiri sendiri, submit terpisah dari formulir penjualan).
export const revisitWeatherSchema = z
  .object({
    outletId: z.string().uuid(),
    clientUuid: z.string().uuid(),
    confirmOverwriteVisitId: z.string().uuid().optional(),
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  })
  .and(weatherSchema);

export type RevisitWeatherInput = z.infer<typeof revisitWeatherSchema>;

// Kunjungan ke-2 dst — Formulir Merek & Penjualan (berdiri sendiri, submit terpisah dari cuaca).
// Jam kunjungan dicatat di sini karena angka sachet ditafsirkan "hingga jam kunjungan" (FR-43).
export const revisitSalesSchema = z
  .object({
    outletId: z.string().uuid(),
    clientUuid: z.string().uuid(),
    confirmOverwriteVisitId: z.string().uuid().optional(),
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    visitTime: visitTimeSchema,
    visitNotes: z.string().trim().optional().nullable(),
    sales: salesArraySchemaRequired,
    // Koordinat opsional (hanya jika "Perbarui Info Warung" dipakai)
    updateLocation: z.boolean().optional().default(false),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    accuracyM: z.coerce.number().min(0).optional().nullable(),
  });

export type RevisitSalesInput = z.infer<typeof revisitSalesSchema>;

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

// Master mengoreksi/menghapus baris kunjungan yang diinput interviewer. Sales boleh kosong
// (0 baris) karena sejak v2.5 sebuah kunjungan bisa baru terisi cuacanya saja (atau
// sebaliknya) — Master tetap bisa membuka & memperbaiki bagian yang sudah ada tanpa
// dipaksa melengkapi bagian yang belum diisi interviewer.
export const masterEditVisitSchema = z
  .object({
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    visitTime: visitTimeSchema,
    notes: z.string().trim().optional().nullable(),
    sales: salesArraySchema,
  })
  .and(weatherSchema);

export type MasterEditVisitInput = z.infer<typeof masterEditVisitSchema>;

export const resetRisetSchema = z.object({
  password: z.string().min(1, "Password wajib diisi"),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Nama merek wajib diisi"),
  variant: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export { normalizeBrandName };
