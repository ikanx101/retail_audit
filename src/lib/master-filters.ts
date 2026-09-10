import { dateOnlyToUTC } from "@/lib/timezone";
import { Prisma } from "@prisma/client";

export interface MasterFilters {
  dateFrom?: string;
  dateTo?: string;
  interviewerId?: string;
  outletId?: string;
  brandName?: string;
  q?: string;
}

export function parseMasterFilters(searchParams: URLSearchParams): MasterFilters {
  return {
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    interviewerId: searchParams.get("interviewerId") ?? undefined,
    outletId: searchParams.get("outletId") ?? undefined,
    brandName: searchParams.get("brandName") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  };
}

export function buildVisitWhere(filters: MasterFilters): Prisma.VisitWhereInput {
  const where: Prisma.VisitWhereInput = { isDeleted: false };

  if (filters.dateFrom || filters.dateTo) {
    where.visitDate = {};
    if (filters.dateFrom) where.visitDate.gte = dateOnlyToUTC(filters.dateFrom);
    if (filters.dateTo) where.visitDate.lte = dateOnlyToUTC(filters.dateTo);
  }
  if (filters.interviewerId) where.interviewerId = filters.interviewerId;
  if (filters.outletId) where.outletId = filters.outletId;
  if (filters.q) {
    where.outlet = { name: { contains: filters.q, mode: "insensitive" } };
  }
  if (filters.brandName) {
    where.sales = { some: { brandNameSnapshot: { equals: filters.brandName, mode: "insensitive" } } };
  }

  return where;
}
