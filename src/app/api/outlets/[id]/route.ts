import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { masterEditOutletSchema } from "@/lib/validations";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;

  const outlet = await prisma.outlet.findUnique({
    where: { id },
    include: {
      visits: {
        where: { isDeleted: false },
        orderBy: { visitDate: "desc" },
        include: { sales: true },
      },
    },
  });

  if (!outlet || outlet.isDeleted) {
    return NextResponse.json({ error: "Warung tidak ditemukan" }, { status: 404 });
  }

  // VL-09: interviewer hanya boleh melihat/mengunjungi ulang warung miliknya sendiri.
  if (session!.user.role === "INTERVIEWER" && outlet.createdById !== session!.user.id) {
    return NextResponse.json({ error: "Anda tidak memiliki akses ke warung ini" }, { status: 403 });
  }

  // Prefill merek (FR-23) diambil dari kunjungan TERAKHIR yang sudah punya data penjualan —
  // bukan sekadar kunjungan terakhir, karena sejak v2.5 kunjungan terbaru bisa saja baru
  // terisi cuacanya saja (formulir penjualan belum disubmit).
  const latestVisitWithSales = outlet.visits.find((v) => v.sales.length > 0);
  const prefillBrands = latestVisitWithSales
    ? latestVisitWithSales.sales.map((s) => ({
        brandId: s.brandId,
        brandName: s.brandNameSnapshot,
        variantNote: s.variantNote,
      }))
    : [];

  return NextResponse.json({
    data: {
      ...outlet,
      visits: outlet.visits.map((v) => ({
        ...v,
        weatherFilled: v.weatherClearH !== null,
        salesFilled: v.sales.length > 0,
      })),
      prefillBrands,
      nextVisitNumber: outlet.visits.length + 1,
    },
  });
}

// PATCH /api/outlets/[id] — Master mengoreksi data warung, atau interviewer mengedit
// warung miliknya sendiri (v3.1) karena beberapa interviewer keburu submit sebelum
// sempat memverifikasi isian formulir Warung Baru.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = masterEditOutletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.outlet.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    return NextResponse.json({ error: "Warung tidak ditemukan" }, { status: 404 });
  }

  const isMaster = session!.user.role === "MASTER_RESEARCHER";
  if (!isMaster && existing.createdById !== session!.user.id) {
    return NextResponse.json({ error: "Anda tidak memiliki akses ke warung ini" }, { status: 403 });
  }

  const input = parsed.data;
  const updated = await prisma.outlet.update({
    where: { id },
    data: {
      name: input.name,
      ownerName: input.ownerName,
      address: input.address,
      phone: input.phone,
      city: input.city || null,
      district: input.district || null,
      openingTime: input.openingTime || null,
      closingTime: input.closingTime || null,
      notes: input.notes || null,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });

  await prisma.auditTrail.create({
    data: {
      entity: "outlet",
      entityId: id,
      action: isMaster ? "master_edit_outlet" : "interviewer_edit_outlet",
      actorId: session!.user.id,
      beforeJson: {
        name: existing.name,
        ownerName: existing.ownerName,
        address: existing.address,
        phone: existing.phone,
        city: existing.city,
        district: existing.district,
        openingTime: existing.openingTime,
        closingTime: existing.closingTime,
        notes: existing.notes,
        latitude: existing.latitude.toString(),
        longitude: existing.longitude.toString(),
      },
      afterJson: { ...input },
    },
  });

  return NextResponse.json({ data: updated });
}
