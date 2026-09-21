import { prisma } from "@/lib/prisma";
import { resolveSaleRows } from "@/lib/visit-service";
import { dateOnlyToUTC, todayWIB } from "@/lib/timezone";
import { isVisitDateValid } from "@/lib/business-rules";
import { outletRegistrationSchema, revisitWeatherSchema, revisitSalesSchema, photoInputSchema } from "@/lib/validations";
import type { Prisma, VisitPhotoForm } from "@prisma/client";
import { z } from "zod";

/**
 * Simpan lampiran foto (v4.2) sebagai baris baru — TIDAK PERNAH menghapus foto lama, lihat
 * catatan append-only di photosArraySchema (validations.ts). Dipanggil di dalam transaksi yang
 * sama dengan create/update kunjungan.
 */
async function createVisitPhotos(
  tx: Prisma.TransactionClient,
  visitId: string,
  form: VisitPhotoForm,
  photos: z.infer<typeof photoInputSchema>[]
) {
  if (photos.length === 0) return;
  await tx.visitPhoto.createMany({
    data: photos.map((p) => ({
      visitId,
      form,
      fileName: p.fileName,
      mimeType: p.mimeType,
      sizeBytes: Buffer.byteLength(p.dataBase64, "base64"),
      data: Buffer.from(p.dataBase64, "base64"),
    })),
  });
}

export class ServiceError extends Error {
  status: number;
  code?: string;
  extra?: Record<string, unknown>;
  constructor(message: string, status = 400, code?: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Kunjungan pertama (v2.5): HANYA registrasi warung — tanpa cuaca & tanpa merek/sachet.
export async function createOutletRegistration(
  interviewerId: string,
  rawInput: z.infer<typeof outletRegistrationSchema>
) {
  const input = rawInput;

  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    throw new ServiceError("Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB).");
  }

  const existingVisit = await prisma.visit.findUnique({ where: { clientUuid: input.clientUuid } });
  if (existingVisit) {
    return { outletId: existingVisit.outletId, visitId: existingVisit.id, idempotent: true };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.create({
        data: {
          name: input.name,
          ownerName: input.ownerName,
          address: input.address,
          phone: input.phone,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyM: input.accuracyM ?? null,
          geolocationSource: input.geolocationSource,
          city: input.city || null,
          district: input.district || null,
          openingTime: input.openingTime,
          closingTime: input.closingTime,
          notes: input.outletNotes || null,
          createdById: interviewerId,
        },
      });

      const visit = await tx.visit.create({
        data: {
          clientUuid: input.clientUuid,
          outletId: outlet.id,
          interviewerId,
          visitNumber: 1,
          visitDate: dateOnlyToUTC(input.visitDate),
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyM: input.accuracyM ?? null,
        },
      });

      return { outlet, visit };
    });

    return { outletId: result.outlet.id, visitId: result.visit.id, idempotent: false };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      throw new ServiceError("Data duplikat (kemungkinan sudah pernah tersimpan).", 409);
    }
    throw err;
  }
}

async function assertOwnedOutlet(outletId: string, interviewerId: string) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet || outlet.isDeleted) {
    throw new ServiceError("Warung tidak ditemukan", 404);
  }
  if (outlet.createdById !== interviewerId) {
    throw new ServiceError("Anda tidak memiliki akses ke warung ini", 403);
  }
  return outlet;
}

/**
 * Cari kunjungan yang sudah ada pada tanggal ini (dibuat oleh formulir cuaca ATAU penjualan
 * sebelumnya), atau siapkan nomor kunjungan berikutnya bila belum ada sama sekali (VL-06/FR-26:
 * satu warung tetap hanya boleh punya satu baris kunjungan per tanggal, terlepas dari formulir
 * mana yang mengisinya lebih dulu).
 */
async function findExistingVisitForDate(outletId: string, visitDateUTC: Date) {
  return prisma.visit.findUnique({
    where: { outletId_visitDate: { outletId, visitDate: visitDateUTC } },
  });
}

/**
 * Interviewer mengedit kunjungan yang sudah tersimpan, TERMASUK mengubah tanggalnya (v4.3).
 * Karena satu warung hanya boleh punya satu baris kunjungan per tanggal, bila tanggal baru
 * sudah dipakai kunjungan lain milik warung ini, seluruh data kunjungan lama pada tanggal itu
 * (cuaca, penjualan, catatan, foto) akan DIGANTIKAN oleh data kunjungan yang sedang diedit —
 * baris lama itu dihapus (cascade) lalu kunjungan yang diedit dipindah ke tanggal baru.
 * Butuh konfirmasi (confirmOverwriteVisitId) sebelum penggantian ini dilakukan.
 */
async function editRevisitWeather(interviewerId: string, input: z.infer<typeof revisitWeatherSchema>) {
  const editingVisitId = input.editingVisitId!;
  const original = await prisma.visit.findUnique({ where: { id: editingVisitId } });
  if (!original || original.isDeleted) {
    throw new ServiceError("Kunjungan yang ingin diedit tidak ditemukan", 404);
  }
  await assertOwnedOutlet(original.outletId, interviewerId);

  const visitDateUTC = dateOnlyToUTC(input.visitDate);
  const sameDate = visitDateUTC.getTime() === original.visitDate.getTime();
  const target = sameDate
    ? null
    : await prisma.visit.findUnique({
        where: { outletId_visitDate: { outletId: original.outletId, visitDate: visitDateUTC } },
      });

  if (target && target.id !== input.confirmOverwriteVisitId) {
    throw new ServiceError(
      "Warung ini sudah punya kunjungan pada tanggal baru tersebut. Data kunjungan lama di tanggal itu akan digantikan. Lanjutkan?",
      409,
      "DUPLICATE_DATE_MOVE",
      { existingVisitId: target.id }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (target) {
      await tx.visit.delete({ where: { id: target.id } });
    }
    await tx.visit.update({
      where: { id: original.id },
      data: {
        visitDate: visitDateUTC,
        weatherHotH: input.weatherHotH,
        weatherClearH: input.weatherClearH,
        weatherCloudyH: input.weatherCloudyH,
        weatherDrizzleH: input.weatherDrizzleH,
        weatherRainH: input.weatherRainH,
        notes: input.visitNotes || null,
      },
    });
    await createVisitPhotos(tx, original.id, "WEATHER", input.photos);
  });

  return { visitId: original.id, idempotent: false };
}

// Kunjungan ke-2 dst — Formulir Cuaca (berdiri sendiri, submit independen dari penjualan).
export async function submitRevisitWeather(
  interviewerId: string,
  input: z.infer<typeof revisitWeatherSchema>
) {
  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    throw new ServiceError("Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB).");
  }

  if (input.editingVisitId) {
    return editRevisitWeather(interviewerId, input);
  }

  await assertOwnedOutlet(input.outletId, interviewerId);

  const existingByClientUuid = await prisma.visit.findUnique({ where: { clientUuid: input.clientUuid } });
  if (existingByClientUuid) {
    return { visitId: existingByClientUuid.id, idempotent: true };
  }

  const visitDateUTC = dateOnlyToUTC(input.visitDate);
  const existing = await findExistingVisitForDate(input.outletId, visitDateUTC);

  // Sudah ada data cuaca untuk tanggal ini (bukan sekadar kunjungan yang baru terisi
  // penjualannya) — minta konfirmasi timpa, kecuali interviewer sudah mengonfirmasi.
  if (existing && existing.weatherClearH !== null && existing.id !== input.confirmOverwriteVisitId) {
    throw new ServiceError(
      "Sudah ada data cuaca pada tanggal ini untuk warung tersebut. Perbarui data cuaca yang ada?",
      409,
      "DUPLICATE_WEATHER",
      { existingVisitId: existing.id }
    );
  }

  try {
    const visitId = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.visit.update({
          where: { id: existing.id },
          data: {
            weatherHotH: input.weatherHotH,
            weatherClearH: input.weatherClearH,
            weatherCloudyH: input.weatherCloudyH,
            weatherDrizzleH: input.weatherDrizzleH,
            weatherRainH: input.weatherRainH,
            notes: input.visitNotes || null,
          },
        });
        await createVisitPhotos(tx, existing.id, "WEATHER", input.photos);
        return existing.id;
      }

      const visitCount = await tx.visit.count({ where: { outletId: input.outletId, isDeleted: false } });
      const visit = await tx.visit.create({
        data: {
          clientUuid: input.clientUuid,
          outletId: input.outletId,
          interviewerId,
          visitNumber: visitCount + 1,
          visitDate: visitDateUTC,
          weatherHotH: input.weatherHotH,
          weatherClearH: input.weatherClearH,
          weatherCloudyH: input.weatherCloudyH,
          weatherDrizzleH: input.weatherDrizzleH,
          weatherRainH: input.weatherRainH,
          notes: input.visitNotes || null,
        },
      });
      await createVisitPhotos(tx, visit.id, "WEATHER", input.photos);
      return visit.id;
    });

    return { visitId, idempotent: false };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      throw new ServiceError("Data duplikat (kemungkinan sudah pernah tersimpan).", 409);
    }
    throw err;
  }
}

/**
 * Interviewer mengedit kunjungan (formulir penjualan) yang sudah tersimpan, TERMASUK mengubah
 * tanggalnya (v4.3). Lihat catatan lengkap di editRevisitWeather — perilakunya sama: bila
 * tanggal baru sudah dipakai kunjungan lain milik warung ini, data kunjungan lama di tanggal
 * itu digantikan (setelah konfirmasi) oleh data kunjungan yang sedang diedit.
 */
async function editRevisitSales(interviewerId: string, input: z.infer<typeof revisitSalesSchema>) {
  const editingVisitId = input.editingVisitId!;
  const original = await prisma.visit.findUnique({ where: { id: editingVisitId } });
  if (!original || original.isDeleted) {
    throw new ServiceError("Kunjungan yang ingin diedit tidak ditemukan", 404);
  }
  await assertOwnedOutlet(original.outletId, interviewerId);

  const visitDateUTC = dateOnlyToUTC(input.visitDate);
  const sameDate = visitDateUTC.getTime() === original.visitDate.getTime();
  const target = sameDate
    ? null
    : await prisma.visit.findUnique({
        where: { outletId_visitDate: { outletId: original.outletId, visitDate: visitDateUTC } },
      });

  if (target && target.id !== input.confirmOverwriteVisitId) {
    throw new ServiceError(
      "Warung ini sudah punya kunjungan pada tanggal baru tersebut. Data kunjungan lama di tanggal itu akan digantikan. Lanjutkan?",
      409,
      "DUPLICATE_DATE_MOVE",
      { existingVisitId: target.id }
    );
  }

  const resolvedSales = await resolveSaleRows(input.sales);

  await prisma.$transaction(async (tx) => {
    if (target) {
      await tx.visit.delete({ where: { id: target.id } });
    }
    await tx.visitSale.deleteMany({ where: { visitId: original.id } });
    await tx.visit.update({
      where: { id: original.id },
      data: {
        visitDate: visitDateUTC,
        visitTime: input.visitTime,
        notes: input.visitNotes || null,
        ...(input.updateLocation && input.latitude != null && input.longitude != null
          ? { latitude: input.latitude, longitude: input.longitude, accuracyM: input.accuracyM ?? null }
          : {}),
      },
    });
    await tx.visitSale.createMany({ data: resolvedSales.map((s) => ({ ...s, visitId: original.id })) });
    await createVisitPhotos(tx, original.id, "SALES", input.photos);

    if (input.updateLocation && input.latitude != null && input.longitude != null) {
      await tx.outlet.update({
        where: { id: original.outletId },
        data: { latitude: input.latitude, longitude: input.longitude, accuracyM: input.accuracyM ?? null },
      });
    }
  });

  return { visitId: original.id, idempotent: false };
}

// Kunjungan ke-2 dst — Formulir Merek & Penjualan (berdiri sendiri, submit independen dari cuaca).
export async function submitRevisitSales(
  interviewerId: string,
  input: z.infer<typeof revisitSalesSchema>
) {
  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    throw new ServiceError("Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB).");
  }

  if (input.editingVisitId) {
    return editRevisitSales(interviewerId, input);
  }

  await assertOwnedOutlet(input.outletId, interviewerId);

  const existingByClientUuid = await prisma.visit.findUnique({ where: { clientUuid: input.clientUuid } });
  if (existingByClientUuid) {
    return { visitId: existingByClientUuid.id, idempotent: true };
  }

  const visitDateUTC = dateOnlyToUTC(input.visitDate);
  const existing = await findExistingVisitForDate(input.outletId, visitDateUTC);
  const existingSalesCount = existing ? await prisma.visitSale.count({ where: { visitId: existing.id } }) : 0;

  // Sudah ada data penjualan untuk tanggal ini — minta konfirmasi timpa, kecuali sudah dikonfirmasi.
  if (existing && existingSalesCount > 0 && existing.id !== input.confirmOverwriteVisitId) {
    throw new ServiceError(
      "Sudah ada data penjualan pada tanggal ini untuk warung tersebut. Perbarui data penjualan yang ada?",
      409,
      "DUPLICATE_SALES",
      { existingVisitId: existing.id }
    );
  }

  const resolvedSales = await resolveSaleRows(input.sales);

  try {
    const visitId = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.visitSale.deleteMany({ where: { visitId: existing.id } });
        await tx.visit.update({
          where: { id: existing.id },
          data: {
            visitTime: input.visitTime,
            notes: input.visitNotes || null,
            ...(input.updateLocation && input.latitude != null && input.longitude != null
              ? { latitude: input.latitude, longitude: input.longitude, accuracyM: input.accuracyM ?? null }
              : {}),
          },
        });
        await tx.visitSale.createMany({ data: resolvedSales.map((s) => ({ ...s, visitId: existing.id })) });
        await createVisitPhotos(tx, existing.id, "SALES", input.photos);

        if (input.updateLocation && input.latitude != null && input.longitude != null) {
          await tx.outlet.update({
            where: { id: input.outletId },
            data: { latitude: input.latitude, longitude: input.longitude, accuracyM: input.accuracyM ?? null },
          });
        }
        return existing.id;
      }

      const visitCount = await tx.visit.count({ where: { outletId: input.outletId, isDeleted: false } });
      const visit = await tx.visit.create({
        data: {
          clientUuid: input.clientUuid,
          outletId: input.outletId,
          interviewerId,
          visitNumber: visitCount + 1,
          visitDate: visitDateUTC,
          visitTime: input.visitTime,
          latitude: input.updateLocation ? input.latitude ?? null : null,
          longitude: input.updateLocation ? input.longitude ?? null : null,
          accuracyM: input.updateLocation ? input.accuracyM ?? null : null,
          notes: input.visitNotes || null,
        },
      });

      if (input.updateLocation && input.latitude != null && input.longitude != null) {
        await tx.outlet.update({
          where: { id: input.outletId },
          data: { latitude: input.latitude, longitude: input.longitude, accuracyM: input.accuracyM ?? null },
        });
      }

      await tx.visitSale.createMany({ data: resolvedSales.map((s) => ({ ...s, visitId: visit.id })) });
      await createVisitPhotos(tx, visit.id, "SALES", input.photos);

      return visit.id;
    });

    return { visitId, idempotent: false };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      throw new ServiceError("Data duplikat (kemungkinan sudah pernah tersimpan).", 409);
    }
    throw err;
  }
}
