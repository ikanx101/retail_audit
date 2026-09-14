import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { resetRisetSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

// Zona berbahaya: Master menghapus SELURUH data riset (warung, kunjungan, penjualan,
// akun interviewer) agar aplikasi kembali ke kondisi baru diinstal. Dikunci di belakang
// konfirmasi password akun Master sendiri (bukan password target) karena aksi ini
// ireversibel dan tidak menyisakan cara untuk membatalkannya.
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = resetRisetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  const actor = await prisma.user.findUnique({ where: { id: session!.user.id } });
  if (!actor) {
    return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  }

  const passwordValid = await bcrypt.compare(parsed.data.password, actor.passwordHash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Password salah" }, { status: 401 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const photos = await tx.visitPhoto.deleteMany();
    const sales = await tx.visitSale.deleteMany();
    const visits = await tx.visit.deleteMany();
    const outlets = await tx.outlet.deleteMany();
    await tx.auditTrail.deleteMany();
    const interviewers = await tx.user.deleteMany({ where: { role: "INTERVIEWER" } });

    return {
      photos: photos.count,
      sales: sales.count,
      visits: visits.count,
      outlets: outlets.count,
      interviewers: interviewers.count,
    };
  });

  await prisma.auditTrail.create({
    data: {
      entity: "system",
      entityId: "reset_riset",
      action: "reset_riset",
      actorId: actor.id,
      afterJson: result,
    },
  });

  logger.warn({ actor: actor.username, result }, "Reset riset dijalankan oleh master");

  return NextResponse.json({ data: result });
}
