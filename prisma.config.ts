import { defineConfig } from "prisma/config";

// Dengan adanya prisma.config.ts, Prisma CLI tidak lagi memuat .env secara otomatis.
// Muat manual untuk pengembangan lokal; di Railway file .env tidak ada dan variabel
// sudah tersedia dari environment, jadi kegagalan di sini aman diabaikan.
try {
  process.loadEnvFile();
} catch {
  // tidak ada file .env
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
