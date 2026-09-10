import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_MASTER_USERNAME ?? "master";
  const password = process.env.SEED_MASTER_PASSWORD ?? "ChangeMe123!";
  const fullName = process.env.SEED_MASTER_FULLNAME ?? "Master Researcher";

  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });

  if (existing) {
    console.log(`Akun master "${username}" sudah ada, seed dilewati.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const master = await prisma.user.create({
    data: {
      username,
      passwordHash,
      fullName,
      role: "MASTER_RESEARCHER",
      isActive: true,
    },
  });

  console.log(`Akun Master Researcher dibuat: ${master.username} (${master.id})`);

  const brandCount = await prisma.brand.count();
  if (brandCount === 0) {
    await prisma.brand.createMany({
      data: [
        { name: "Nutrisari", category: "Serbuk", createdById: master.id },
        { name: "Good Day", category: "Kopi", createdById: master.id },
        { name: "ABC Susu", category: "Kopi", createdById: master.id },
        { name: "Kapal Api Sachet", category: "Kopi", createdById: master.id },
        { name: "Torabika", category: "Kopi", createdById: master.id },
        { name: "Marimas", category: "Serbuk", createdById: master.id },
        { name: "Segar Sari", category: "Serbuk", createdById: master.id },
        { name: "Pop Ice", category: "Minuman Es", createdById: master.id },
      ],
    });
    console.log("Master daftar merek awal ditambahkan.");
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
