import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { createInterviewerSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

// FR-08, FR-10: Master membuat & melihat daftar akun interviewer + ringkasan aktivitas.
export async function GET() {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const interviewers = await prisma.user.findMany({
    where: { role: "INTERVIEWER" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          outlets: { where: { isDeleted: false } },
          visits: { where: { isDeleted: false } },
        },
      },
    },
  });

  return NextResponse.json({
    data: interviewers.map((i) => ({
      id: i.id,
      username: i.username,
      fullName: i.fullName,
      phone: i.phone,
      region: i.region,
      isActive: i.isActive,
      lastLoginAt: i.lastLoginAt,
      createdAt: i.createdAt,
      outletCount: i._count.outlets,
      visitCount: i._count.visits,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createInterviewerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  const { fullName, username, password, phone, region } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const interviewer = await prisma.user.create({
    data: {
      username,
      fullName,
      passwordHash,
      phone: phone || null,
      region: region || null,
      role: "INTERVIEWER",
      isActive: true,
      createdById: session!.user.id,
    },
  });

  await prisma.auditTrail.create({
    data: {
      entity: "user",
      entityId: interviewer.id,
      action: "create_interviewer",
      actorId: session!.user.id,
      afterJson: { username, fullName, phone, region },
    },
  });

  logger.info({ interviewerId: interviewer.id }, "interviewer dibuat");

  return NextResponse.json(
    { data: { id: interviewer.id, username: interviewer.username, fullName: interviewer.fullName } },
    { status: 201 }
  );
}
