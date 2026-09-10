import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { newOutletVisitSchema, revisitSchema } from "@/lib/validations";
import { createOutletWithFirstVisit, createOrUpdateRevisit, ServiceError } from "@/lib/outlet-service";
import { logger } from "@/lib/logger";

const batchItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("new_outlet"), clientUuid: z.string().uuid(), payload: newOutletVisitSchema }),
  z.object({ type: z.literal("revisit"), clientUuid: z.string().uuid(), payload: revisitSchema }),
]);

const batchSchema = z.object({ items: z.array(batchItemSchema).min(1).max(100) });

// POST /api/sync/batch — kirim antrean offline sekaligus (FR-38..FR-40).
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole("INTERVIEWER");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  const results: { clientUuid: string; ok: boolean; error?: string; data?: unknown }[] = [];

  for (const item of parsed.data.items) {
    try {
      if (item.type === "new_outlet") {
        const data = await createOutletWithFirstVisit(session!.user.id, item.payload);
        results.push({ clientUuid: item.clientUuid, ok: true, data });
      } else {
        const data = await createOrUpdateRevisit(session!.user.id, item.payload);
        results.push({ clientUuid: item.clientUuid, ok: true, data });
      }
    } catch (err: unknown) {
      if (err instanceof ServiceError) {
        results.push({ clientUuid: item.clientUuid, ok: false, error: err.message });
      } else {
        logger.error({ err, clientUuid: item.clientUuid }, "gagal sinkronisasi batch item");
        results.push({ clientUuid: item.clientUuid, ok: false, error: "Gagal menyimpan data" });
      }
    }
  }

  return NextResponse.json({ data: results });
}
