import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { parseMasterFilters, buildVisitWhere } from "@/lib/master-filters";
import { isGpsAccuracyPoor } from "@/lib/business-rules";
import { roundHours } from "@/lib/utils";

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
      outlet: { select: { id: true, name: true } },
      interviewer: { select: { fullName: true } },
      sales: true,
    },
  });

  const anomalies = visits
    .map((v) => {
      const reasons: string[] = [];

      // Sejak v2.5: kunjungan ke-2 dst diisi lewat dua formulir independen (cuaca & penjualan)
      // yang boleh disubmit terpisah — jadi salah satunya kosong itu wajar (belum diisi),
      // bukan berarti kunjungan pertama (registrasi warung, visitNumber 1) yang memang tidak
      // pernah mengisi keduanya.
      const isFirstVisit = v.visitNumber === 1;
      const weatherFilled = v.weatherClearH !== null;
      if (!isFirstVisit && !weatherFilled) reasons.push("Data cuaca belum diisi (formulir cuaca belum disubmit)");

      // Sejak v1.5: total jam cuaca tidak wajib 24 jam (interviewer bebas mengisi sesuai kondisi
      // yang teramati). Hanya ditandai bila total melebihi 24 jam — itu tetap mustahil untuk satu hari.
      if (weatherFilled) {
        const totalWeather = roundHours(
          (v.weatherHotH ?? 0) + v.weatherClearH! + v.weatherCloudyH! + v.weatherDrizzleH! + v.weatherRainH!
        );
        if (totalWeather > 24) reasons.push(`Total jam cuaca = ${totalWeather} (melebihi 24 jam, periksa kembali)`);
      }

      const totalSachets = v.sales.reduce((sum, s) => sum + s.sachetsSold, 0);
      if (!isFirstVisit && v.sales.length === 0) {
        reasons.push("Data penjualan belum diisi (formulir penjualan belum disubmit)");
      } else if (v.sales.length > 0 && totalSachets === 0) {
        reasons.push("Penjualan 0 sachet pada semua merek");
      }

      if (isGpsAccuracyPoor(v.accuracyM ? Number(v.accuracyM) : null)) {
        reasons.push(`Akurasi GPS buruk (${v.accuracyM} m)`);
      }

      const brandNames = v.sales.map((s) => s.brandNameSnapshot.trim().toLowerCase());
      if (new Set(brandNames).size !== brandNames.length) reasons.push("Merek duplikat dalam satu kunjungan");

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
