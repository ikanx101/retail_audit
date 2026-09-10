-- Jam operasional warung (dikumpulkan saat kunjungan pertama)
ALTER TABLE "outlets" ADD COLUMN "opening_time" TEXT;
ALTER TABLE "outlets" ADD COLUMN "closing_time" TEXT;

-- Relaksasi aturan bisnis: total jam cuaca tidak lagi wajib berjumlah/dibatasi 24 jam.
-- Batas per-field (0-24 jam masing-masing kondisi) tetap berlaku.
ALTER TABLE "visits" DROP CONSTRAINT IF EXISTS "visits_weather_total_h_check";
