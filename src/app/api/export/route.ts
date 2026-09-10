import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/api-auth";
import { parseMasterFilters } from "@/lib/master-filters";
import {
  buildLongFormatRows,
  buildWideFormatRows,
  rowsToCsv,
  exportFileName,
  LONG_FORMAT_COLUMNS,
} from "@/lib/export";

// GET /api/export?format=csv|xlsx&layout=long|wide&...filter — bagian 12.
export async function GET(req: NextRequest) {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const searchParams = new URL(req.url).searchParams;
  const format = (searchParams.get("format") ?? "xlsx") as "csv" | "xlsx";
  const layout = (searchParams.get("layout") ?? "long") as "long" | "wide";
  const filters = parseMasterFilters(searchParams);

  const filename = exportFileName(format, layout);

  let rows: Record<string, string | number>[];
  let columns: string[];

  if (layout === "wide") {
    const wide = await buildWideFormatRows(filters);
    rows = wide.rows;
    columns = [
      "interviewer_username",
      "interviewer_name",
      "outlet_id",
      "warung",
      "pemilik",
      "alamat",
      "telepon",
      "latitude",
      "longitude",
      "visit_number",
      "tanggal_kunjungan",
      "jam_kunjungan",
      "jam_cerah",
      "jam_mendung",
      "jam_gerimis",
      "jam_hujan",
      "total_jam",
      "sumber_data",
      ...wide.brandColumns,
    ];
  } else {
    rows = await buildLongFormatRows(filters);
    columns = [...LONG_FORMAT_COLUMNS];
  }

  if (format === "csv") {
    const csv = rowsToCsv(rows, columns);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(layout === "long" ? "Long Format" : "Wide Format");
  sheet.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(14, Math.min(30, c.length + 4)) }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
