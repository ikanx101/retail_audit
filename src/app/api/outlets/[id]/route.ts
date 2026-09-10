import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

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

  const latestVisit = outlet.visits[0];
  const prefillBrands = latestVisit
    ? latestVisit.sales.map((s) => ({
        brandId: s.brandId,
        brandName: s.brandNameSnapshot,
        variantNote: s.variantNote,
      }))
    : [];

  return NextResponse.json({
    data: {
      ...outlet,
      prefillBrands,
      nextVisitNumber: outlet.visits.length + 1,
    },
  });
}
