import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { resolveSaleRows } from "@/lib/visit-service";
import { dateOnlyToUTC, todayWIB } from "@/lib/timezone";
import { isVisitDateValid } from "@/lib/business-rules";
import { newOutletVisitSchema, revisitSchema } from "@/lib/validations";
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

export async function createOutletWithFirstVisit(
  interviewerId: string,
  rawInput: z.infer<typeof newOutletVisitSchema>
) {
  const input = rawInput;

  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    throw new ServiceError("Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB).");
  }

  const existingVisit = await prisma.visit.findUnique({ where: { clientUuid: input.clientUuid } });
  if (existingVisit) {
    return { outletId: existingVisit.outletId, visitId: existingVisit.id, idempotent: true };
  }

  const resolvedSales = await resolveSaleRows(input.sales);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.create({
        data: {
          name: input.name,
          ownerName: input.ownerName,
          address: input.address,
          phone: normalizePhone(input.phone),
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
          visitTime: input.visitTime,
          weatherClearH: input.weatherClearH,
          weatherCloudyH: input.weatherCloudyH,
          weatherDrizzleH: input.weatherDrizzleH,
          weatherRainH: input.weatherRainH,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyM: input.accuracyM ?? null,
          notes: input.visitNotes || null,
        },
      });

      await tx.visitSale.createMany({ data: resolvedSales.map((s) => ({ ...s, visitId: visit.id })) });

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

export async function createOrUpdateRevisit(
  interviewerId: string,
  input: z.infer<typeof revisitSchema>
) {
  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    throw new ServiceError("Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB).");
  }

  const outlet = await prisma.outlet.findUnique({ where: { id: input.outletId } });
  if (!outlet || outlet.isDeleted) {
    throw new ServiceError("Warung tidak ditemukan", 404);
  }
  if (outlet.createdById !== interviewerId) {
    throw new ServiceError("Anda tidak memiliki akses ke warung ini", 403);
  }

  const existingByClientUuid = await prisma.visit.findUnique({ where: { clientUuid: input.clientUuid } });
  if (existingByClientUuid) {
    return { visitId: existingByClientUuid.id, idempotent: true };
  }

  const visitDateUTC = dateOnlyToUTC(input.visitDate);

  const existingSameDate = await prisma.visit.findUnique({
    where: { outletId_visitDate: { outletId: input.outletId, visitDate: visitDateUTC } },
  });

  if (existingSameDate && existingSameDate.id !== input.confirmOverwriteVisitId) {
    throw new ServiceError(
      "Sudah ada kunjungan pada tanggal ini untuk warung tersebut. Perbarui kunjungan yang ada?",
      409,
      "DUPLICATE_DATE",
      { existingVisitId: existingSameDate.id }
    );
  }

  const resolvedSales = await resolveSaleRows(input.sales);

  try {
    const visitId = await prisma.$transaction(async (tx) => {
      if (existingSameDate) {
        await tx.visitSale.deleteMany({ where: { visitId: existingSameDate.id } });
        await tx.visit.update({
          where: { id: existingSameDate.id },
          data: {
            visitTime: input.visitTime,
            weatherClearH: input.weatherClearH,
            weatherCloudyH: input.weatherCloudyH,
            weatherDrizzleH: input.weatherDrizzleH,
            weatherRainH: input.weatherRainH,
            notes: input.visitNotes || null,
            ...(input.updateLocation && input.latitude != null && input.longitude != null
              ? { latitude: input.latitude, longitude: input.longitude, accuracyM: input.accuracyM ?? null }
              : {}),
          },
        });
        await tx.visitSale.createMany({ data: resolvedSales.map((s) => ({ ...s, visitId: existingSameDate.id })) });
        return existingSameDate.id;
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
          weatherClearH: input.weatherClearH,
          weatherCloudyH: input.weatherCloudyH,
          weatherDrizzleH: input.weatherDrizzleH,
          weatherRainH: input.weatherRainH,
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
