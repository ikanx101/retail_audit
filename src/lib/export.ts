import { prisma } from "@/lib/prisma";
import type { MasterFilters } from "@/lib/master-filters";
import { buildVisitWhere } from "@/lib/master-filters";
import { formatDateWIB } from "@/lib/timezone";

export const LONG_FORMAT_COLUMNS = [
  "interviewer_username",
  "interviewer_name",
  "outlet_id",
  "warung",
  "pemilik",
  "alamat",
  "telepon",
  "latitude",
  "longitude",
  "accuracy_m",
  "visit_number",
  "tanggal_kunjungan",
  "jam_kunjungan",
  "jam_cerah",
  "jam_mendung",
  "jam_gerimis",
  "jam_hujan",
  "total_jam",
  "merek",
  "varian",
  "sachet_terjual_hari_ini",
  "is_merek_baru",
  "catatan",
  "sumber_data",
  "created_at",
] as const;

async function fetchVisitsForExport(filters: MasterFilters) {
  const where = buildVisitWhere(filters);
  return prisma.visit.findMany({
    where,
    orderBy: { visitDate: "desc" },
    include: {
      outlet: true,
      interviewer: { select: { username: true, fullName: true } },
      sales: true,
    },
  });
}

export async function buildLongFormatRows(filters: MasterFilters) {
  const visits = await fetchVisitsForExport(filters);
  const rows: Record<string, string | number>[] = [];

  for (const v of visits) {
    const totalJam = v.weatherClearH + v.weatherCloudyH + v.weatherDrizzleH + v.weatherRainH;
    for (const s of v.sales) {
      rows.push({
        interviewer_username: v.interviewer.username,
        interviewer_name: v.interviewer.fullName,
        outlet_id: v.outletId,
        warung: v.outlet.name,
        pemilik: v.outlet.ownerName,
        alamat: v.outlet.address,
        telepon: v.outlet.phone,
        latitude: Number(v.outlet.latitude),
        longitude: Number(v.outlet.longitude),
        accuracy_m: v.outlet.accuracyM ? Number(v.outlet.accuracyM) : "",
        visit_number: v.visitNumber,
        tanggal_kunjungan: formatDateWIB(v.visitDate),
        jam_kunjungan: v.visitTime,
        jam_cerah: v.weatherClearH,
        jam_mendung: v.weatherCloudyH,
        jam_gerimis: v.weatherDrizzleH,
        jam_hujan: v.weatherRainH,
        total_jam: totalJam,
        merek: s.brandNameSnapshot,
        varian: s.variantNote ?? "",
        sachet_terjual_hari_ini: s.sachetsSold,
        is_merek_baru: s.isNewBrand ? "ya" : "tidak",
        catatan: v.notes ?? "",
        sumber_data: v.isOfflineCreated ? "offline" : "online",
        created_at: formatDateWIB(v.createdAt),
      });
    }
  }
  return rows;
}

export async function buildWideFormatRows(filters: MasterFilters) {
  const visits = await fetchVisitsForExport(filters);

  const brandSet = new Set<string>();
  for (const v of visits) for (const s of v.sales) brandSet.add(s.brandNameSnapshot);
  const brands = [...brandSet].sort((a, b) => a.localeCompare(b));

  const rows: Record<string, string | number>[] = [];
  for (const v of visits) {
    const totalJam = v.weatherClearH + v.weatherCloudyH + v.weatherDrizzleH + v.weatherRainH;
    const row: Record<string, string | number> = {
      interviewer_username: v.interviewer.username,
      interviewer_name: v.interviewer.fullName,
      outlet_id: v.outletId,
      warung: v.outlet.name,
      pemilik: v.outlet.ownerName,
      alamat: v.outlet.address,
      telepon: v.outlet.phone,
      latitude: Number(v.outlet.latitude),
      longitude: Number(v.outlet.longitude),
      visit_number: v.visitNumber,
      tanggal_kunjungan: formatDateWIB(v.visitDate),
      jam_kunjungan: v.visitTime,
      jam_cerah: v.weatherClearH,
      jam_mendung: v.weatherCloudyH,
      jam_gerimis: v.weatherDrizzleH,
      jam_hujan: v.weatherRainH,
      total_jam: totalJam,
      sumber_data: v.isOfflineCreated ? "offline" : "online",
    };
    for (const brand of brands) {
      const sale = v.sales.find((s) => s.brandNameSnapshot === brand);
      row[`${brand} (sachet hari ini)`] = sale ? sale.sachetsSold : "";
    }
    rows.push(row);
  }
  return { rows, brandColumns: brands.map((b) => `${b} (sachet hari ini)`) };
}

export function rowsToCsv(rows: Record<string, string | number>[], columns: string[]): string {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? "");
    if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const header = columns.map(escapeCell).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c] ?? "")).join(",")).join("\n");
  const BOM = "﻿"; // agar rapi di Excel (bagian 12)
  return `${BOM}${header}\n${body}\n`;
}

export function exportFileName(format: "csv" | "xlsx", layout: "long" | "wide") {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const stamp = wib.toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/(\d{8})(\d{4})/, "$1-$2");
  return `retail-audit-${layout}-${stamp}.${format}`;
}
