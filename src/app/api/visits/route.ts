import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { revisitSchema } from "@/lib/validations";
import { createOrUpdateRevisit, ServiceError } from "@/lib/outlet-service";
import { logger } from "@/lib/logger";

// POST /api/visits — kunjungan ulang, idempotent via client_uuid (FR-22..FR-27).
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole("INTERVIEWER");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = revisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await createOrUpdateRevisit(session!.user.id, parsed.data);
    logger.info({ visitId: result.visitId }, "kunjungan ulang tersimpan");
    return NextResponse.json({ data: result }, { status: result.idempotent ? 200 : 201 });
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.code ?? err.message, message: err.message, ...err.extra }, { status: err.status });
    }
    logger.error({ err }, "gagal menyimpan kunjungan ulang");
    return NextResponse.json({ error: "Gagal menyimpan data. Coba lagi." }, { status: 500 });
  }
}
