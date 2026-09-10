import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession } from "@/lib/api-auth";
import { newOutletVisitSchema } from "@/lib/validations";
import { createOutletWithFirstVisit, ServiceError } from "@/lib/outlet-service";
import { logger } from "@/lib/logger";

// GET /api/outlets?mine=1&q= — daftar warung milik interviewer (FR-21).
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine");
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = { isDeleted: false };
  if (mine === "1" || session!.user.role === "INTERVIEWER") {
    where.createdById = session!.user.id;
  }
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const outlets = await prisma.outlet.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      visits: { orderBy: { visitDate: "desc" }, take: 1, where: { isDeleted: false } },
      _count: { select: { visits: { where: { isDeleted: false } } } },
    },
  });

  return NextResponse.json({
    data: outlets.map((o) => ({
      id: o.id,
      name: o.name,
      ownerName: o.ownerName,
      address: o.address,
      phone: o.phone,
      latitude: o.latitude,
      longitude: o.longitude,
      city: o.city,
      district: o.district,
      visitCount: o._count.visits,
      lastVisitDate: o.visits[0]?.visitDate ?? null,
    })),
  });
}

// POST /api/outlets — kunjungan pertama: buat warung + kunjungan + penjualan (transaksi, FR-19).
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole("INTERVIEWER");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = newOutletVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await createOutletWithFirstVisit(session!.user.id, parsed.data);
    logger.info({ outletId: result.outletId, visitId: result.visitId }, "kunjungan pertama tersimpan");
    return NextResponse.json({ data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    logger.error({ err }, "gagal menyimpan kunjungan pertama");
    return NextResponse.json({ error: "Gagal menyimpan data. Coba lagi." }, { status: 500 });
  }
}
