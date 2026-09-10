# Retail Audit Sachet

Webapps untuk pelaksanaan studi **market research (retail audit)** pada warung kopi dan toko
kelontong yang menjual minuman sachet. Dipakai oleh dua peran:

- **Master Researcher** — mengelola akun interviewer, memantau dashboard, mengunduh data.
- **Interviewer** — melakukan kunjungan lapangan (kunjungan pertama & kunjungan ulang) dari gadget.

Spesifikasi lengkap ada di [`requirement.md`](./requirement.md). Dokumen ini berisi panduan
penggunaan dan panduan deployment.

---

## Daftar Isi

1. [Tumpukan Teknologi](#tumpukan-teknologi)
2. [Menjalankan di Lokal](#menjalankan-di-lokal)
3. [Panduan Penggunaan](#panduan-penggunaan)
4. [Deployment ke Railway](#deployment-ke-railway)
5. [Struktur Proyek](#struktur-proyek)
6. [Testing & CI](#testing--ci)
7. [Status Implementasi & Batasan](#status-implementasi--batasan)

---

## Tumpukan Teknologi

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) |
| Styling & UI | Tailwind CSS v4, komponen kustom bergaya shadcn/ui |
| Form & Validasi | React Hook Form + Zod (skema dipakai bersama client & server) |
| Data client | TanStack Query v5 |
| Peta | Leaflet + react-leaflet + tile OpenStreetMap (gratis, tanpa API key) |
| Grafik | Recharts |
| Database | PostgreSQL 16 |
| ORM | Prisma 6 (`prisma migrate`) |
| Auth | Auth.js (NextAuth v5) — Credentials Provider, sesi JWT `httpOnly` |
| Offline | Dexie.js (IndexedDB) untuk draft & antrean sinkronisasi + Service Worker app-shell |
| Export | ExcelJS (XLSX) + generator CSV bawaan |
| Testing | Vitest (unit), ESLint + Prettier |
| Deployment | Railway (Nixpacks, plugin PostgreSQL) + GitHub Actions CI |

---

## Menjalankan di Lokal

### Prasyarat

- Node.js **20 LTS** (lihat `.nvmrc`)
- PostgreSQL 16 (bisa pakai Docker, lihat di bawah)
- npm

### 1. Clone & install dependencies

```bash
git clone <url-repo-anda> retail-audit-sachet
cd retail-audit-sachet
npm install
```

### 2. Siapkan database PostgreSQL

Opsi cepat dengan Docker:

```bash
docker run -d --name retail_audit_pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=retail_audit \
  -p 5432:5432 postgres:16-alpine
```

### 3. Salin file environment

```bash
cp .env.example .env
```

Sesuaikan `DATABASE_URL` dan `DIRECT_URL` bila perlu. Generate `AUTH_SECRET` yang aman:

```bash
openssl rand -base64 32
```

### 4. Jalankan migrasi & seed

```bash
npx prisma migrate deploy   # terapkan skema (atau `npx prisma migrate dev` saat pengembangan)
npm run seed                 # membuat akun Master Researcher pertama + master merek awal
```

Username & password akun master pertama diambil dari `SEED_MASTER_USERNAME` /
`SEED_MASTER_PASSWORD` di `.env`. **Segera login dan ganti/perkuat kredensial ini di
lingkungan produksi.**

### 5. Jalankan server pengembangan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Anda akan diarahkan ke `/login`.

### Skrip npm yang tersedia

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan (hot reload) |
| `npm run build` | `prisma generate` + build produksi Next.js |
| `npm run start` | Jalankan build produksi |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit test (Vitest) |
| `npm run prisma:migrate` | Migrasi baru saat pengembangan (`prisma migrate dev`) |
| `npm run prisma:deploy` | Terapkan migrasi (dipakai saat deploy) |
| `npm run prisma:studio` | Buka Prisma Studio (GUI database) |
| `npm run seed` | Jalankan seed akun master + master merek |

---

## Panduan Penggunaan

### Sebagai Master Researcher

1. **Login** di `/login` dengan akun master (dibuat via seed, atau akun master lain).
2. **Kelola Interviewer** (`/master/interviewer`) — klik "+ Tambah Interviewer", isi nama
   lengkap, username, dan password awal. Sampaikan kredensial ke interviewer via
   WhatsApp/Telegram. Anda juga bisa menonaktifkan akun atau mereset password dari halaman ini
   (password baru hanya ditampilkan **satu kali**, segera salin dan sampaikan).
3. **Master Daftar Merek** (`/master/merek`) — opsional, menambah daftar merek yang akan muncul
   sebagai saran (suggestion) saat interviewer mengisi form. Interviewer tetap bisa menambah
   merek baru yang tidak ada di daftar ini.
4. **Dashboard Ringkasan** (`/master`) — kartu ringkasan (jumlah warung, kunjungan, sachet,
   dsb), tren harian, komposisi merek, dan sebaran per interviewer. Gunakan filter tanggal,
   interviewer, merek, atau nama warung di bagian atas untuk mempersempit data — filter ini
   berlaku juga di halaman Kunjungan, Kualitas Data, dan Export.
5. **Warung** (`/master/warungs`) — daftar & peta sebaran warung. Klik warung untuk melihat
   riwayat kunjungan dan tren penjualan per merek (drill-down).
6. **Kunjungan** (`/master/kunjungan`) — tabel seluruh kunjungan dengan pagination.
7. **Kualitas Data** (`/master/kualitas-data`) — daftar kunjungan dengan anomali: total jam
   cuaca ≠ 24, penjualan 0 sachet di semua merek, akurasi GPS buruk, merek duplikat, nomor
   telepon tidak valid, atau total penjualan > 500 sachet dalam satu kunjungan (kemungkinan
   input kumulatif, bukan harian). Tindak lanjuti temuan ini dengan interviewer terkait.
8. **Export** (`/master/export`) — unduh data dalam format CSV atau XLSX, layout *long* (satu
   baris per kombinasi kunjungan × merek, cocok untuk analisis) atau *wide* (satu baris per
   kunjungan, kolom merek dinamis, cocok untuk pivot cepat). Mengikuti filter yang aktif.

> **Penting — definisi angka penjualan:** setiap angka "sachet terjual" pada dashboard, tabel,
> dan export adalah **penjualan pada hari kunjungan itu saja, hingga jam kunjungan** — bukan
> kumulatif dan bukan sejak kunjungan sebelumnya. Jam kunjungan selalu tersedia di kolom
> `jam_kunjungan` untuk membantu interpretasi.

### Sebagai Interviewer

1. **Login** dengan akun yang diberikan Master Researcher.
2. **Warung Baru** (kunjungan pertama) — isi data warung (nama, pemilik, alamat, telepon),
   ambil lokasi GPS dengan tombol "📍 Ambil Lokasi" (atau geser pin di peta / ketuk lokasi baru
   untuk koreksi manual), isi tanggal & jam kunjungan, kondisi cuaca dalam jam, dan daftar merek
   + jumlah sachet **terjual hari itu saja**. Minimal satu merek wajib diisi.
3. **Kunjungan Ulang** — pilih warung dari daftar warung yang pernah Anda input (bisa dicari).
   Merek dari kunjungan sebelumnya otomatis dimuat — konfirmasi ulang angkanya (boleh 0 bila
   tidak ada penjualan hari itu). Anda bisa menambah merek baru bila ada. Centang "Perbarui
   koordinat" bila lokasi warung perlu dikoreksi.
4. Sistem akan meminta **konfirmasi tambahan** (bukan menolak) bila: jam kunjungan di luar
   04:00–23:00, total penjualan satu kunjungan > 500 sachet, atau akurasi GPS > 50 m — ini untuk
   membantu Anda menghindari salah input, bukan untuk memblokir pekerjaan Anda.
5. Bila warung sudah punya kunjungan pada tanggal yang sama, sistem akan menawarkan untuk
   **memperbarui** kunjungan tersebut alih-alih membuat data baru (satu warung = satu data per
   hari).
6. **Status Sinkronisasi** (`/interviewer/sinkronisasi`) — pantau data yang masih menunggu
   dikirim (misalnya karena sinyal lemah/offline saat submit). Data tersimpan otomatis secara
   lokal dan akan tersinkron sendiri saat koneksi kembali; Anda juga bisa menekan "Kirim Ulang".
7. Form yang sedang diisi **tersimpan otomatis sebagai draft** di perangkat Anda — aman bila
   aplikasi tertutup atau baterai habis sebelum sempat menyimpan.

---

## Deployment ke Railway

### Ringkasan arsitektur di Railway

Satu project Railway berisi:

- **Service aplikasi** — dibuat dari repo GitHub ini, auto-deploy setiap push ke `main`.
- **Plugin PostgreSQL** — database utama (bukan SQLite/MySQL/file lokal).

### Langkah-langkah

1. **Push kode ini ke GitHub** (repo baru, mis. `retail-audit-sachet`), branch `main`.

2. **Buat project baru di Railway** ([railway.app](https://railway.app)) → *New Project* →
   *Deploy from GitHub repo* → pilih repo ini.

3. **Tambahkan plugin PostgreSQL** ke project yang sama: *New* → *Database* → *Add PostgreSQL*.
   Railway otomatis menyediakan variabel `DATABASE_URL` (pooled, via PgBouncer) dan koneksi
   langsung yang bisa dipetakan ke `DIRECT_URL` (lihat langkah 4).

4. **Atur Environment Variables** pada service aplikasi (tab *Variables*):

   | Variabel | Nilai |
   |---|---|
   | `DATABASE_URL` | Reference ke `Postgres.DATABASE_URL` (pooled) dari plugin Postgres |
   | `DIRECT_URL` | Reference ke `Postgres.DATABASE_URL` juga (atau URL koneksi langsung non-pooled jika tersedia) — dipakai khusus untuk `prisma migrate deploy` |
   | `AUTH_SECRET` | Hasil `openssl rand -base64 32` (rahasia, jangan dipakai ulang dari lokal) |
   | `NEXTAUTH_URL` | URL publik service, mis. `https://retail-audit-sachet.up.railway.app` |
   | `APP_BASE_URL` | Sama seperti `NEXTAUTH_URL` |
   | `SEED_MASTER_USERNAME` | Username akun master pertama, mis. `master` |
   | `SEED_MASTER_PASSWORD` | Password awal yang kuat — segera ganti setelah login pertama |
   | `SEED_MASTER_FULLNAME` | Nama tampilan akun master |
   | `TZ` | `Asia/Jakarta` |
   | `NODE_ENV` | `production` |
   | `SENTRY_DSN` | (opsional) DSN Sentry bila ingin mengaktifkan error tracking |

   Railway secara default menyediakan referensi variabel plugin dengan sintaks
   `${{Postgres.DATABASE_URL}}` — gunakan ini agar `DATABASE_URL`/`DIRECT_URL` otomatis
   mengikuti kredensial plugin tanpa hardcode.

5. **Build & start command** sudah diatur lewat [`railway.json`](./railway.json) di root repo:
   - Build: `npm ci && npm run build` (termasuk `prisma generate`)
   - Start: `npx prisma migrate deploy && npm run start` — migrasi database dijalankan otomatis
     sebelum aplikasi start setiap kali deploy.
   - Healthcheck: `/api/health` (mengecek koneksi database).

6. **Deploy.** Railway akan build & jalankan otomatis. Pantau log build untuk memastikan
   `prisma migrate deploy` sukses.

7. **Jalankan seed akun master pertama** (sekali saja, setelah deploy pertama sukses). Dari tab
   *Shell* service di Railway (atau `railway run` via Railway CLI dari lokal):

   ```bash
   npm run seed
   ```

   Ini membuat satu akun `MASTER_RESEARCHER` menggunakan `SEED_MASTER_USERNAME` /
   `SEED_MASTER_PASSWORD` yang sudah diatur di langkah 4.

8. **Login** ke URL produksi dengan akun master tersebut, lalu mulai buat akun interviewer dari
   menu **Kelola Interviewer**.

### Auto-deploy & CI

- Setiap push ke `main` memicu **GitHub Actions** ([`ci.yml`](./.github/workflows/ci.yml)):
  install → lint → typecheck → `prisma validate` → migrasi ke database CI sementara → unit
  test → build. Jika CI merah, jangan merge/deploy.
- Setelah CI hijau dan kode masuk ke `main`, Railway otomatis membangun & men-deploy ulang.

### Backup

- Aktifkan **backup harian** PostgreSQL bawaan Railway (tab *Backups* pada plugin Postgres).
- Uji **prosedur restore** minimal sekali sebelum studi berjalan penuh (AC-11), mis. restore ke
  environment staging terpisah.

### Environment staging (opsional, disarankan)

Buat environment Railway kedua (`develop`) dengan plugin PostgreSQL terpisah, terhubung ke
branch `develop`, agar perubahan bisa diuji sebelum masuk `main`/produksi.

---

## Struktur Proyek

```
prisma/
  schema.prisma        # model data (bagian 6 requirement.md)
  migrations/           # migrasi SQL (termasuk generated column & check constraint manual)
  seed.ts               # seed akun master pertama + master merek awal
src/
  app/
    login/               # halaman login
    interviewer/         # seluruh halaman peran interviewer (mobile-first)
    master/               # seluruh halaman peran master (dashboard, tabel, export, dst.)
    api/                  # route handlers (auth, outlets, visits, sync, master/*, export, health)
  auth.ts                # konfigurasi Auth.js (NextAuth v5)
  middleware.ts           # proteksi route berbasis role
  lib/                    # validasi Zod, aturan bisnis, Prisma client, offline (Dexie), dll.
  components/              # komponen UI (form, dashboard, ui dasar bergaya shadcn/ui)
public/
  manifest.json, sw.js, icons/   # aset PWA
railway.json               # konfigurasi build/start/healthcheck Railway
.github/workflows/ci.yml   # pipeline CI
```

---

## Testing & CI

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript strict
npm run test         # Vitest — unit test aturan bisnis (VL-01..VL-11) & validasi telepon
npx prisma validate  # validasi skema Prisma
npm run build         # build produksi (memastikan semua route valid)
```

Unit test saat ini berfokus pada fungsi aturan bisnis murni di `src/lib/business-rules.ts` dan
`src/lib/phone.ts` (mudah diuji tanpa database). Endpoint API telah diverifikasi manual end-to-end
(login, buat warung + kunjungan pertama, kunjungan ulang, deteksi duplikat tanggal, idempotency
`client_uuid`, RBAC, export CSV/XLSX) terhadap PostgreSQL sungguhan selama pengembangan.

---

## Status Implementasi & Batasan

Fase 1 (MVP) dan sebagian besar Fase 2–3 pada `requirement.md` sudah diimplementasikan:
autentikasi & RBAC, manajemen akun interviewer, form kunjungan pertama & ulang lengkap dengan
validasi (VL-01..VL-11), transaksi database, dashboard (ringkasan, grafik, peta, tabel, panel
kualitas data), export CSV/XLSX (long & wide), draft autosave, antrean offline dengan
idempotency `client_uuid`, dan PWA dasar (manifest + service worker app-shell).

Yang **belum/parsial** diimplementasikan (jujur disampaikan agar tidak jadi asumsi keliru):

- **Playwright e2e** dan **Sentry** belum disertakan (disebutkan opsional/lapis observability
  tambahan di requirement, section 8.7 & 8.8) — CI saat ini memakai unit test Vitest.
- **Export sangat besar (>~50 ribu baris)**: implementasi saat ini memuat data ke memori sebelum
  menulis file, bukan streaming baris-per-baris. Cukup untuk skala awal studi; untuk skala
  ratusan ribu baris (NFR-02), pertimbangkan menambah streaming writer (ExcelJS mendukung mode
  stream) atau raw SQL aggregation untuk endpoint dashboard.
- **Foto warung/label merek, multi-studi, notifikasi WhatsApp/Telegram** — eksplisit Fase 4
  (opsional) pada requirement, belum dibuat.
- **Audit trail** tersedia di skema (`audit_trail`) dan dicatat untuk aksi kelola interviewer
  serta merek, namun belum ada halaman UI untuk menelusurinya.
- Ikon PWA (`public/icons/`) adalah placeholder sederhana — ganti dengan aset brand resmi bila
  tersedia sebelum dipublikasikan ke pengguna akhir.

Semua batasan di atas tidak mempengaruhi alur inti (login, input kunjungan, sinkronisasi
offline, dashboard, export) yang sudah diuji berjalan end-to-end.
