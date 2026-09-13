/*
  Warnings:

  - You are about to drop the column `weather_total_h` on the `visits` table. All the data in the column will be lost.

*/
-- v2.5: kunjungan ke-2 dst kini diisi lewat dua formulir independen (cuaca & penjualan
-- merek/sachet), masing-masing bisa disubmit terpisah untuk tanggal kunjungan yang sama.
-- visit_time & kolom cuaca jadi nullable: null berarti formulir terkait belum diisi.
-- weather_total_h (kolom generated, tidak pernah dipetakan di Prisma schema & tidak dipakai
-- kode aplikasi) turut dibersihkan.
-- AlterTable
ALTER TABLE "visits" DROP COLUMN "weather_total_h",
ALTER COLUMN "visit_time" DROP NOT NULL,
ALTER COLUMN "weather_clear_h" DROP NOT NULL,
ALTER COLUMN "weather_clear_h" DROP DEFAULT,
ALTER COLUMN "weather_cloudy_h" DROP NOT NULL,
ALTER COLUMN "weather_cloudy_h" DROP DEFAULT,
ALTER COLUMN "weather_drizzle_h" DROP NOT NULL,
ALTER COLUMN "weather_drizzle_h" DROP DEFAULT,
ALTER COLUMN "weather_rain_h" DROP NOT NULL,
ALTER COLUMN "weather_rain_h" DROP DEFAULT;
