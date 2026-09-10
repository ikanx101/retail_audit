import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  fullName: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
});

// FR-10: Master mengaktifkan/menonaktifkan akun interviewer.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "INTERVIEWER") {
    return NextResponse.json({ error: "Interviewer tidak ditemukan" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
  });

  await prisma.auditTrail.create({
    data: {
      entity: "user",
      entityId: id,
      action: "update_interviewer",
      actorId: session!.user.id,
      beforeJson: { isActive: target.isActive, fullName: target.fullName, phone: target.phone, region: target.region },
      afterJson: parsed.data,
    },
  });

  return NextResponse.json({
    data: { id: updated.id, isActive: updated.isActive, fullName: updated.fullName },
  });
}
