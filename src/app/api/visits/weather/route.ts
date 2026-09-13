import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { revisitWeatherSchema } from "@/lib/validations";
import { submitRevisitWeather, ServiceError } from "@/lib/outlet-service";
import { logger } from "@/lib/logger";

// POST /api/visits/weather — kunjungan ulang, formulir Cuaca (berdiri sendiri, idempotent via client_uuid).
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole("INTERVIEWER");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = revisitWeatherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await submitRevisitWeather(session!.user.id, parsed.data);
    logger.info({ visitId: result.visitId }, "kunjungan ulang (cuaca) tersimpan");
    return NextResponse.json({ data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.code ?? err.message, message: err.message, ...err.extra }, { status: err.status });
    }
    logger.error({ err }, "gagal menyimpan kunjungan ulang (cuaca)");
    return NextResponse.json({ error: "Gagal menyimpan data. Coba lagi." }, { status: 500 });
  }
}
