/*
  Warnings:

  - You are about to drop the column `path` on the `visit_photos` table. All the data in the column will be lost.
  - Added the required column `data` to the `visit_photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_name` to the `visit_photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `form` to the `visit_photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mime_type` to the `visit_photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size_bytes` to the `visit_photos` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VisitPhotoForm" AS ENUM ('WEATHER', 'SALES');

-- AlterTable
ALTER TABLE "visit_photos" DROP COLUMN "path",
ADD COLUMN     "data" BYTEA NOT NULL,
ADD COLUMN     "file_name" TEXT NOT NULL,
ADD COLUMN     "form" "VisitPhotoForm" NOT NULL,
ADD COLUMN     "mime_type" TEXT NOT NULL,
ADD COLUMN     "size_bytes" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "visit_photos_visit_id_idx" ON "visit_photos"("visit_id");

-- AddForeignKey
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
