import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  variant: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const brand = await prisma.brand.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ data: brand });
}
