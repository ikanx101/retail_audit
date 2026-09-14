import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { parseMasterFilters, buildVisitWhere } from "@/lib/master-filters";
import { roundHours } from "@/lib/utils";

// GET /api/master/visits — tabel kunjungan dengan pagination, sorting, pencarian (FR-30, FR-31).
export async function GET(req: NextRequest) {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const searchParams = new URL(req.url).searchParams;
  const filters = parseMasterFilters(searchParams);
  const where = buildVisitWhere(filters);

  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const [total, visits] = await Promise.all([
    prisma.visit.count({ where }),
    prisma.visit.findMany({
      where,
      orderBy: { visitDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        outlet: { select: { id: true, name: true, address: true, city: true, district: true } },
        interviewer: { select: { id: true, fullName: true, username: true } },
        sales: true,
      },
    }),
  ]);

  // Sejak v2.5: cuaca & penjualan diisi lewat dua formulir independen — sebuah kunjungan bisa
  // untuk sementara baru terisi salah satunya. `weatherFilled`/`salesFilled` menandai bagian
  // mana yang masih kosong agar Master tahu formulir mana yang belum disubmit interviewer.
  const data = visits.map((v) => {
    const weatherFilled = v.weatherClearH !== null;
    return {
      id: v.id,
      outlet: v.outlet,
      interviewer: v.interviewer,
      visitNumber: v.visitNumber,
      visitDate: v.visitDate,
      visitTime: v.visitTime,
      weatherFilled,
      weather: weatherFilled
        ? {
            hot: v.weatherHotH ?? 0,
            clear: v.weatherClearH!,
            cloudy: v.weatherCloudyH!,
            drizzle: v.weatherDrizzleH!,
            rain: v.weatherRainH!,
            total: roundHours(
              (v.weatherHotH ?? 0) + v.weatherClearH! + v.weatherCloudyH! + v.weatherDrizzleH! + v.weatherRainH!
            ),
          }
        : null,
      salesFilled: v.sales.length > 0,
      sales: v.sales.map((s) => ({
        brand: s.brandNameSnapshot,
        sachetsSold: s.sachetsSold,
        isNewBrand: s.isNewBrand,
      })),
      totalSachets: v.sales.reduce((sum, s) => sum + s.sachetsSold, 0),
      isOfflineCreated: v.isOfflineCreated,
    };
  });

  return NextResponse.json({ data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } });
}
