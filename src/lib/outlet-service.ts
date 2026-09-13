import { prisma } from "@/lib/prisma";
import { resolveSaleRows } from "@/lib/visit-service";
import { dateOnlyToUTC, todayWIB } from "@/lib/timezone";
import { isVisitDateValid } from "@/lib/business-rules";
import { outletRegistrationSchema, revisitWeatherSchema, revisitSalesSchema } from "@/lib/validations";
import { z } from "zod";

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

// Kunjungan ke-2 dst — Formulir Cuaca (berdiri sendiri, submit independen dari penjualan).
export async function submitRevisitWeather(
  interviewerId: string,
  input: z.infer<typeof revisitWeatherSchema>
) {
  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    throw new ServiceError("Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB).");
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
            weatherClearH: input.weatherClearH,
            weatherCloudyH: input.weatherCloudyH,
            weatherDrizzleH: input.weatherDrizzleH,
            weatherRainH: input.weatherRainH,
          },
        });
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
          weatherClearH: input.weatherClearH,
          weatherCloudyH: input.weatherCloudyH,
          weatherDrizzleH: input.weatherDrizzleH,
          weatherRainH: input.weatherRainH,
        },
      });
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

// Kunjungan ke-2 dst — Formulir Merek & Penjualan (berdiri sendiri, submit independen dari cuaca).
export async function submitRevisitSales(
  interviewerId: string,
  input: z.infer<typeof revisitSalesSchema>
) {
  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    throw new ServiceError("Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB).");
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
