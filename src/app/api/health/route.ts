import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const BUILD_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.npm_package_version ?? "dev";

// Variabel env yang wajib ada agar aplikasi bisa berfungsi dengan benar (bagian 10 requirement.md).
const REQUIRED_ENV_VARS = ["DATABASE_URL", "AUTH_SECRET"] as const;

interface CheckResult {
  status: "ok" | "error";
  message?: string;
  latencyMs?: number;
}

/**
 * Healthcheck diagnostik untuk Railway (`railway.json` -> healthcheckPath).
 *
 * Mengembalikan status per komponen agar saat deployment bermasalah, penyebabnya bisa
 * langsung dibedakan: environment variable hilang, database tidak bisa dihubungi, atau
 * migrasi database belum diterapkan. Bila endpoint ini SAMA SEKALI tidak bisa diakses
 * (timeout/connection refused, bukan respons JSON), berarti proses aplikasi sendiri gagal
 * start — penyebabnya harus dicari di log build/deploy Railway, bukan di sini.
 */
export async function GET() {
  const time = new Date().toISOString();
  const checks: Record<string, CheckResult> = {};

  // 1. Aplikasi & routing — sampai ke baris ini saja sudah membuktikan proses Node.js
  //    dan Next.js route handler berjalan normal.
  checks.app = { status: "ok" };

  // 2. Variabel environment wajib
  const missingEnv = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  checks.env =
    missingEnv.length === 0
      ? { status: "ok" }
      : { status: "error", message: `Variabel env belum diatur: ${missingEnv.join(", ")}` };

  // 3. Konektivitas database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    logger.error({ err }, "healthcheck: koneksi database gagal");
    checks.database = {
      status: "error",
      message: err instanceof Error ? err.message : "Tidak dapat terhubung ke database",
    };
  }

  // 4. Skema/migrasi — mendeteksi kasus umum "database tersambung tapi tabel belum ada"
  //    karena `prisma migrate deploy` belum atau gagal dijalankan saat deploy.
  if (checks.database.status === "ok") {
    try {
      await prisma.user.count();
      checks.migrations = { status: "ok" };
    } catch (err) {
      logger.error({ err }, "healthcheck: skema database belum lengkap (migrasi belum diterapkan?)");
      checks.migrations = {
        status: "error",
        message: "Tabel database tidak ditemukan — kemungkinan `prisma migrate deploy` belum berhasil dijalankan.",
      };
    }
  } else {
    checks.migrations = { status: "error", message: "Dilewati karena database tidak terhubung." };
  }

  const overallOk = Object.values(checks).every((c) => c.status === "ok");
  const failing = Object.entries(checks)
    .filter(([, c]) => c.status === "error")
    .map(([name]) => name);

  if (!overallOk) {
    logger.error({ failing, checks }, "healthcheck gagal");
  }

  return NextResponse.json(
    {
      status: overallOk ? "ok" : "error",
      version: BUILD_VERSION,
      time,
      failing: overallOk ? [] : failing,
      checks,
    },
    { status: overallOk ? 200 : 503 }
  );
}
