import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { parseMasterFilters, buildVisitWhere } from "@/lib/master-filters";

// GET /api/master/summary — FR-28, FR-29.
export async function GET(req: NextRequest) {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const filters = parseMasterFilters(new URL(req.url).searchParams);
  const where = buildVisitWhere(filters);

  const visits = await prisma.visit.findMany({
    where,
    select: { id: true, visitDate: true, interviewerId: true, outletId: true },
  });
  const visitIds = visits.map((v) => v.id);

  const [outletCount, visitCount, activeInterviewerCount, sales, interviewers] = await Promise.all([
    prisma.outlet.count({ where: { isDeleted: false, id: { in: [...new Set(visits.map((v) => v.outletId))] } } }),
    Promise.resolve(visits.length),
    prisma.user.count({ where: { role: "INTERVIEWER", isActive: true } }),
    prisma.visitSale.findMany({
      where: { visitId: { in: visitIds } },
      select: { visitId: true, brandNameSnapshot: true, sachetsSold: true },
    }),
    prisma.user.findMany({ where: { role: "INTERVIEWER" }, select: { id: true, fullName: true } }),
  ]);

  const totalSachets = sales.reduce((sum, s) => sum + s.sachetsSold, 0);
  const brandSet = new Set(sales.map((s) => s.brandNameSnapshot.trim().toLowerCase()));

  // Tren per hari
  const visitDateById = new Map(visits.map((v) => [v.id, v.visitDate.toISOString().slice(0, 10)]));
  const trendMap = new Map<string, number>();
  for (const s of sales) {
    const date = visitDateById.get(s.visitId);
    if (!date) continue;
    trendMap.set(date, (trendMap.get(date) ?? 0) + s.sachetsSold);
  }
  const trend = [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total }));

  // Komposisi per merek (top 10)
  const brandMap = new Map<string, number>();
  for (const s of sales) {
    const key = s.brandNameSnapshot;
    brandMap.set(key, (brandMap.get(key) ?? 0) + s.sachetsSold);
  }
  const brandComposition = [...brandMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([brand, total]) => ({ brand, total }));

  // Sebaran per interviewer
  const interviewerNameById = new Map(interviewers.map((i) => [i.id, i.fullName]));
  const interviewerIdByVisit = new Map(visits.map((v) => [v.id, v.interviewerId]));
  const perInterviewerMap = new Map<string, number>();
  for (const s of sales) {
    const interviewerId = interviewerIdByVisit.get(s.visitId);
    if (!interviewerId) continue;
    perInterviewerMap.set(interviewerId, (perInterviewerMap.get(interviewerId) ?? 0) + s.sachetsSold);
  }
  const perInterviewer = [...perInterviewerMap.entries()]
    .map(([id, total]) => ({ interviewer: interviewerNameById.get(id) ?? "?", total }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    data: {
      outletCount,
      visitCount,
      activeInterviewerCount,
      totalSachets,
      avgSachetsPerOutlet: outletCount > 0 ? Math.round((totalSachets / outletCount) * 100) / 100 : 0,
      brandCount: brandSet.size,
      trend,
      brandComposition,
      perInterviewer,
    },
  });
}
