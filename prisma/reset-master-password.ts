import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Reset (atau buat) akun Master Researcher memakai SEED_MASTER_USERNAME /
 * SEED_MASTER_PASSWORD saat ini. Berbeda dari prisma/seed.ts (yang hanya membuat akun
 * baru dan MELEWATI jika sudah ada), skrip ini selalu menimpa password akun yang sudah
 * ada — dipakai saat lupa/salah set password master pertama, atau akun tidak sengaja
 * ter-nonaktifkan. Jalankan manual (bukan bagian dari alur deploy otomatis):
 *
 *   npm run reset-master-password
 */
async function main() {
  const username = process.env.SEED_MASTER_USERNAME;
  const password = process.env.SEED_MASTER_PASSWORD;
  const fullName = process.env.SEED_MASTER_FULLNAME ?? "Master Researcher";

  if (!username || !password) {
    console.error("SEED_MASTER_USERNAME dan SEED_MASTER_PASSWORD wajib diatur di environment.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });

  if (existing) {
    if (existing.role !== "MASTER_RESEARCHER") {
      console.error(
        `Akun "${existing.username}" sudah ada tapi berperan ${existing.role}, bukan MASTER_RESEARCHER. Dibatalkan.`
      );
      process.exit(1);
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, isActive: true },
    });
    console.log(`Password akun master "${existing.username}" berhasil direset & akun diaktifkan.`);
  } else {
    const created = await prisma.user.create({
      data: { username, passwordHash, fullName, role: "MASTER_RESEARCHER", isActive: true },
    });
    console.log(`Akun master "${created.username}" dibuat (belum ada sebelumnya).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
