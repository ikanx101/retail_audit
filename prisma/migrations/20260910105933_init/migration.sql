-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MASTER_RESEARCHER', 'INTERVIEWER');

-- CreateEnum
CREATE TYPE "GeolocationSource" AS ENUM ('GPS', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "region" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_log" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy_m" DECIMAL(10,2),
    "geolocation_source" "GeolocationSource" NOT NULL DEFAULT 'GPS',
    "city" TEXT,
    "district" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "client_uuid" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "interviewer_id" TEXT NOT NULL,
    "visit_number" INTEGER NOT NULL,
    "visit_date" DATE NOT NULL,
    "visit_time" TEXT NOT NULL,
    "weather_clear_h" INTEGER NOT NULL DEFAULT 0,
    "weather_cloudy_h" INTEGER NOT NULL DEFAULT 0,
    "weather_drizzle_h" INTEGER NOT NULL DEFAULT 0,
    "weather_rain_h" INTEGER NOT NULL DEFAULT 0,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "accuracy_m" DECIMAL(10,2),
    "notes" TEXT,
    "is_offline_created" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_sales" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "brand_id" TEXT,
    "brand_name_snapshot" TEXT NOT NULL,
    "sachets_sold" INTEGER NOT NULL,
    "variant_note" TEXT,
    "is_new_brand" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_photos" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_trail" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "auth_log_username_idx" ON "auth_log"("username");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE INDEX "outlets_created_by_idx" ON "outlets"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "visits_client_uuid_key" ON "visits"("client_uuid");

-- CreateIndex
CREATE INDEX "visits_outlet_id_visit_date_idx" ON "visits"("outlet_id", "visit_date");

-- CreateIndex
CREATE INDEX "visits_interviewer_id_idx" ON "visits"("interviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "visits_outlet_id_visit_date_key" ON "visits"("outlet_id", "visit_date");

-- CreateIndex
CREATE INDEX "visit_sales_visit_id_idx" ON "visit_sales"("visit_id");

-- CreateIndex
CREATE INDEX "visit_sales_brand_id_idx" ON "visit_sales"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_sales_visit_id_brand_name_snapshot_key" ON "visit_sales"("visit_id", "brand_name_snapshot");

-- CreateIndex
CREATE INDEX "audit_trail_entity_entity_id_idx" ON "audit_trail"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sales" ADD CONSTRAINT "visit_sales_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_sales" ADD CONSTRAINT "visit_sales_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Generated column: total jam cuaca (VL-01)
ALTER TABLE "visits" ADD COLUMN "weather_total_h" INTEGER
  GENERATED ALWAYS AS ("weather_clear_h" + "weather_cloudy_h" + "weather_drizzle_h" + "weather_rain_h") STORED;

-- Check constraints (integritas di level DB, bukan hanya validasi aplikasi)
ALTER TABLE "visits" ADD CONSTRAINT "visits_weather_clear_h_check" CHECK ("weather_clear_h" BETWEEN 0 AND 24);
ALTER TABLE "visits" ADD CONSTRAINT "visits_weather_cloudy_h_check" CHECK ("weather_cloudy_h" BETWEEN 0 AND 24);
ALTER TABLE "visits" ADD CONSTRAINT "visits_weather_drizzle_h_check" CHECK ("weather_drizzle_h" BETWEEN 0 AND 24);
ALTER TABLE "visits" ADD CONSTRAINT "visits_weather_rain_h_check" CHECK ("weather_rain_h" BETWEEN 0 AND 24);
ALTER TABLE "visits" ADD CONSTRAINT "visits_weather_total_h_check" CHECK ("weather_total_h" <= 24);
ALTER TABLE "visits" ADD CONSTRAINT "visits_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90);
ALTER TABLE "visits" ADD CONSTRAINT "visits_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "outlets" ADD CONSTRAINT "outlets_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180);

ALTER TABLE "visit_sales" ADD CONSTRAINT "visit_sales_sachets_sold_check" CHECK ("sachets_sold" >= 0 AND "sachets_sold" <= 100000);
