import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

function generateReadablePassword(): string {
  // Password acak yang cukup kuat namun tetap mudah dibacakan lewat WhatsApp/Telegram.
  const bytes = crypto.randomBytes(6).toString("base64url");
  return `Rb${bytes}!`;
}

// FR-09: Master reset password interviewer; sistem menampilkan password baru satu kali.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "INTERVIEWER") {
    return NextResponse.json({ error: "Interviewer tidak ditemukan" }, { status: 404 });
  }

  const newPassword = generateReadablePassword();
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({ where: { id }, data: { passwordHash } });

  await prisma.auditTrail.create({
    data: {
      entity: "user",
      entityId: id,
      action: "reset_password",
      actorId: session!.user.id,
    },
  });

  return NextResponse.json({ data: { newPassword } });
}
