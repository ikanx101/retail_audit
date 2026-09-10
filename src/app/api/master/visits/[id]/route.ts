import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { masterEditVisitSchema } from "@/lib/validations";
import { resolveSaleRows } from "@/lib/visit-service";
import { dateOnlyToUTC, todayWIB } from "@/lib/timezone";
import { isVisitDateValid } from "@/lib/business-rules";
import { logger } from "@/lib/logger";

// GET /api/master/visits/[id] — detail satu kunjungan untuk form edit Master.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const { id } = await params;

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      outlet: { select: { id: true, name: true } },
      interviewer: { select: { fullName: true, username: true } },
      sales: true,
    },
  });

  if (!visit || visit.isDeleted) {
    return NextResponse.json({ error: "Kunjungan tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ data: visit });
}

// PATCH /api/master/visits/[id] — Master mengoreksi data kunjungan yang diinput interviewer.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = masterEditVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  if (!isVisitDateValid(input.visitDate, todayWIB())) {
    return NextResponse.json(
      { error: "Tanggal kunjungan harus antara 2026-01-01 dan hari ini (WIB)." },
      { status: 400 }
    );
  }

  const existing = await prisma.visit.findUnique({ where: { id }, include: { sales: true } });
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: "Kunjungan tidak ditemukan" }, { status: 404 });
  }

  const visitDateUTC = dateOnlyToUTC(input.visitDate);

  // VL-06/FR-26: satu warung tidak boleh punya dua kunjungan pada tanggal yang sama.
  if (visitDateUTC.getTime() !== existing.visitDate.getTime()) {
    const clashing = await prisma.visit.findUnique({
      where: { outletId_visitDate: { outletId: existing.outletId, visitDate: visitDateUTC } },
    });
    if (clashing && clashing.id !== existing.id) {
      return NextResponse.json(
        { error: "Warung ini sudah punya kunjungan lain pada tanggal tersebut." },
        { status: 409 }
      );
    }
  }

  const resolvedSales = await resolveSaleRows(input.sales);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.visitSale.deleteMany({ where: { visitId: id } });
      await tx.visit.update({
        where: { id },
        data: {
          visitDate: visitDateUTC,
          visitTime: input.visitTime,
          weatherClearH: input.weatherClearH,
          weatherCloudyH: input.weatherCloudyH,
          weatherDrizzleH: input.weatherDrizzleH,
          weatherRainH: input.weatherRainH,
          notes: input.notes || null,
        },
      });
      await tx.visitSale.createMany({ data: resolvedSales.map((s) => ({ ...s, visitId: id })) });
    });

    await prisma.auditTrail.create({
      data: {
        entity: "visit",
        entityId: id,
        action: "master_edit_visit",
        actorId: session!.user.id,
        beforeJson: {
          visitDate: existing.visitDate.toISOString(),
          visitTime: existing.visitTime,
          weatherClearH: existing.weatherClearH,
          weatherCloudyH: existing.weatherCloudyH,
          weatherDrizzleH: existing.weatherDrizzleH,
          weatherRainH: existing.weatherRainH,
          notes: existing.notes,
          sales: existing.sales.map((s) => ({ brand: s.brandNameSnapshot, sachetsSold: s.sachetsSold })),
        },
        afterJson: { ...input },
      },
    });

    logger.info({ visitId: id, actorId: session!.user.id }, "master mengedit kunjungan");

    return NextResponse.json({ data: { id } });
  } catch (err: unknown) {
    logger.error({ err }, "gagal mengedit kunjungan (master)");
    return NextResponse.json({ error: "Gagal menyimpan perubahan. Coba lagi." }, { status: 500 });
  }
}

// DELETE /api/master/visits/[id] — Master menghapus (soft delete) baris kunjungan.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.visit.findUnique({ where: { id }, include: { sales: true } });
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: "Kunjungan tidak ditemukan" }, { status: 404 });
  }

  await prisma.visit.update({ where: { id }, data: { isDeleted: true } });

  await prisma.auditTrail.create({
    data: {
      entity: "visit",
      entityId: id,
      action: "master_delete_visit",
      actorId: session!.user.id,
      beforeJson: {
        outletId: existing.outletId,
        visitDate: existing.visitDate.toISOString(),
        visitTime: existing.visitTime,
        sales: existing.sales.map((s) => ({ brand: s.brandNameSnapshot, sachetsSold: s.sachetsSold })),
      },
    },
  });

  logger.info({ visitId: id, actorId: session!.user.id }, "master menghapus kunjungan");

  return NextResponse.json({ data: { id, deleted: true } });
}
