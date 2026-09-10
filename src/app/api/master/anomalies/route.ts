import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { parseMasterFilters, buildVisitWhere } from "@/lib/master-filters";
import { isGpsAccuracyPoor } from "@/lib/business-rules";
import { isValidIndonesianPhone } from "@/lib/phone";

// GET /api/master/anomalies — panel kualitas data (FR-34).
export async function GET(req: NextRequest) {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const filters = parseMasterFilters(new URL(req.url).searchParams);
  const where = buildVisitWhere(filters);

  const visits = await prisma.visit.findMany({
    where,
    orderBy: { visitDate: "desc" },
    take: 500,
    include: {
      outlet: { select: { id: true, name: true, phone: true } },
      interviewer: { select: { fullName: true } },
      sales: true,
    },
  });

  const anomalies = visits
    .map((v) => {
      const reasons: string[] = [];
      const totalWeather = v.weatherClearH + v.weatherCloudyH + v.weatherDrizzleH + v.weatherRainH;
      if (totalWeather !== 24) reasons.push(`Total jam cuaca = ${totalWeather} (bukan 24)`);

      const totalSachets = v.sales.reduce((sum, s) => sum + s.sachetsSold, 0);
      if (totalSachets === 0) reasons.push("Penjualan 0 sachet pada semua merek");

      if (isGpsAccuracyPoor(v.accuracyM ? Number(v.accuracyM) : null)) {
        reasons.push(`Akurasi GPS buruk (${v.accuracyM} m)`);
      }

      const brandNames = v.sales.map((s) => s.brandNameSnapshot.trim().toLowerCase());
      if (new Set(brandNames).size !== brandNames.length) reasons.push("Merek duplikat dalam satu kunjungan");

      if (!isValidIndonesianPhone(v.outlet.phone)) reasons.push("Nomor telepon warung tidak valid");

      if (totalSachets > 500) reasons.push("Total penjualan harian > 500 sachet (periksa kembali)");

      return { visit: v, reasons };
    })
    .filter((a) => a.reasons.length > 0)
    .map((a) => ({
      visitId: a.visit.id,
      outlet: a.visit.outlet.name,
      interviewer: a.visit.interviewer.fullName,
      visitDate: a.visit.visitDate,
      visitTime: a.visit.visitTime,
      reasons: a.reasons,
    }));

  return NextResponse.json({ data: anomalies });
}
