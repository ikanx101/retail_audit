# Requirement — Webapps Retail Audit Minuman Sachet

**Nama proyek (usulan):** `retail-audit-sachet`
**Pemilik produk:** Ikang Fadhli (Master Researcher)
**Versi dokumen:** 1.1 — 10 September 2026
**Status:** Draft untuk direview
**Riwayat perubahan:**
- v1.0 (10 Sep 2026) — draft awal.
- v1.1 (10 Sep 2026) — **definisi metrik sachet terjual dikonfirmasi**: penjualan **hari kunjungan
  itu saja** (daily sales, hingga jam kunjungan), bukan kumulatif/per periode. Ditambahkan
  field **jam kunjungan** (FR-43, FR-47), label eksplisit pada UI & export (FR-44),
  validasi rentang harian (FR-45), kaidah satu hari satu data (FR-46), VL-10 & VL-11, AC-13.

---

## 1. Ringkasan & Tujuan

Membangun webapps untuk pelaksanaan **studi market research berupa retail audit** pada
**warung kopi dan toko kelontong** yang menjual **minuman sachet**.

Webapps digunakan oleh dua jenis pengguna:

- **Master Researcher** — mengelola akun interviewer dan memantau/mengunduh data hasil kunjungan.
- **Interviewer** — melakukan kunjungan lapangan dan mengisi hasil retail audit dari gadget.

Tujuan utama:

1. Digitalisasi formulir retail audit (kunjungan pertama & kunjungan ulang).
2. Menjaga integritas dan kelengkapan data lapangan (termasuk koordinat GPS & kondisi cuaca).
3. Menyediakan data tabular siap analisis (CSV/XLSX) untuk Master Researcher.
4. Berjalan stabil di perangkat mobile interviewer, termasuk saat sinyal lemah.
5. Menegaskan definisi metrik penjualan: **"sachet terjual" = jumlah sachet yang terjual
   pada hari kunjungan itu saja (daily sales)** — bukan angka kumulatif dan bukan
   penjualan sejak kunjungan sebelumnya. Berlaku sama untuk kunjungan pertama maupun
   kunjungan ulang.

---

## 2. Ruang Lingkup

**Termasuk dalam lingkup:**

- Login berbasis username & password (tanpa registrasi publik).
- Manajemen akun interviewer oleh Master Researcher (buat, reset password, nonaktifkan).
- Form kunjungan pertama (registrasi warung + data audit awal).
- Form kunjungan ulang (tanggal, cuaca, penjualan per merek, tambah merek baru).
- Penyimpanan data permanen di database server + antrean offline di perangkat.
- Dashboard Master Researcher (ringkasan, filter, peta sebaran, unduh data).

**Di luar lingkup (versi ini):**

- Aplikasi native Android/iOS.
- Perhitungan analitik lanjutan (market share model, forecasting, weighting sampel).
- Integrasi langsung ke data panel/syndicated (Nielsen, Kantar, dsb).
- Multi-tenant (satu instance = satu studi/klien).

---

## 3. Peran & Hak Akses (RBAC)

Dua peran: `MASTER_RESEARCHER` dan `INTERVIEWER`.

**MASTER_RESEARCHER**

- Membuat akun interviewer (username, nama lengkap, password awal).
- Melihat daftar akun, mengubah status aktif/nonaktif, mereset password.
- Melihat dashboard data hasil kunjungan.
- Melihat peta sebaran warung.
- Mengunduh data tabular (CSV & XLSX).
- Mengelola master daftar merek (opsional, lihat FR-09).
- Tidak melakukan input kunjungan (kecuali fitur khusus diaktifkan).

**INTERVIEWER**

- Login dengan akun yang dibuat Master Researcher.
- Membuat data warung baru pada kunjungan pertama.
- Mengisi kunjungan ulang untuk warung yang pernah ia input.
- Melihat riwayat kunjungan miliknya sendiri.
- Tidak dapat melihat data interviewer lain.
- Tidak dapat mengunduh seluruh basis data.

---

## 4. Alur Kerja

### 4.1 Master Researcher

1. Login ke webapps.
2. Membuka menu **Kelola Interviewer**, menambahkan akun (username, nama lengkap, password awal).
3. Menyerahkan kredensial ke interviewer (via WhatsApp/Telegram).
4. Memantau dashboard: jumlah warung, jumlah kunjungan, total sachet, sebaran merek.
5. Memfilter data (rentang tanggal, interviewer, warung, merek).
6. Mengunduh data tabular untuk analisis lanjutan.
7. Menjaga kualitas data: menandai/menindaklanjuti data janggal (lihat FR-21).

### 4.2 Interviewer — Kunjungan Pertama

1. Membuka webapps di gadget, memasukkan username & password.
2. Memilih **Warung Baru**.
3. Mengisi form kunjungan pertama:
   - Nama warung (wajib)
   - Nama pemilik (wajib)
   - Alamat (wajib, teks bebas)
   - Koordinat long/lat dari GPS gadget (wajib, dapat dikoreksi manual)
   - Nomor telepon pemilik (wajib, validasi format Indonesia)
   - Tanggal kunjungan (wajib, default hari ini)
   - Jam kunjungan (wajib, default jam perangkat)
   - Kondisi cuaca hari itu dalam satuan jam: cerah, mendung, gerimis, hujan
   - Daftar merek minuman sachet yang dijual + jumlah sachet terjual **hari itu (hingga jam kunjungan)** per merek
4. Menyimpan. Sistem menyimpan data secara permanen dan menampilkan konfirmasi.

### 4.3 Interviewer — Kunjungan ke-2 dan Seterusnya

1. Login, memilih **Kunjungan Ulang**.
2. Memilih nama warung dari daftar warung yang pernah ia input (pencarian + daftar terakhir dikunjungi).
3. Halaman beralih ke form kunjungan ulang:
   - Tanggal kunjungan
   - Jam kunjungan
   - Kondisi cuaca (cerah/mendung/gerimis/hujan, masing-masing dalam jam)
   - Jumlah sachet terjual **pada hari itu saja (hingga jam kunjungan)** untuk setiap merek
     yang sudah tercatat pada kunjungan pertama
   - Tambah merek baru + jumlah sachet terjualnya (jika ada merek baru)
   - (Opsional) perbarui koordinat GPS bila lokasi berbeda/tidak akurat
4. Menyimpan. Data tidak boleh hilang.

---

## 5. Kebutuhan Fungsional

### 5.1 Autentikasi & Sesi

- **FR-01** Login dengan username + password. Username unik (case-insensitive).
- **FR-02** Tidak ada halaman registrasi publik. Akun hanya dibuat Master Researcher.
- **FR-03** Tidak ada self-service signup; lupa password hanya bisa direset Master Researcher.
- **FR-04** Sesi bertahan (session cookie) minimal 30 hari, agar interviewer tidak perlu login berulang.
- **FR-05** Rate limit percobaan login (mis. maksimal 10 percobaan/menit/IP) dan kunci sementara 15 menit setelah 5 kali gagal untuk akun yang sama.
- **FR-06** Setiap akun punya status `aktif`/`nonaktif`; akun nonaktif tidak dapat login.
- **FR-07** Semua percobaan login (berhasil/gagal) dicatat di tabel `auth_log` (username, waktu, IP, user agent).

### 5.2 Manajemen Akun (Master)

- **FR-08** Master dapat membuat akun interviewer: nama lengkap, username, password awal, (opsional) nomor HP, wilayah tugas.
- **FR-09** Master dapat reset password interviewer; sistem menampilkan password baru satu kali.
- **FR-10** Master dapat mengaktifkan/menonaktifkan akun dan melihat ringkasan aktivitas interviewer (jumlah warung & kunjungan).
- **FR-11** Master dapat mengelola master daftar merek minuman sachet (nama merek, varian, kategori, status aktif) sebagai *suggestion list* untuk interviewer.
- **FR-12** Interviewer tetap boleh menambahkan merek baru di lapangan meskipun tidak ada di master list (dengan konfirmasi "tambah merek baru").

### 5.3 Form Kunjungan Pertama (Registrasi Warung)

- **FR-13** Field wajib: nama warung, nama pemilik, alamat, koordinat GPS, nomor telepon pemilik, tanggal kunjungan.
- **FR-14** **Geolokasi:** ambil `latitude`, `longitude`, `accuracy` (meter), dan `captured_at` memakai browser Geolocation API (high accuracy).
  - Tombol "Ambil Lokasi" + indikator akurasi.
  - Jika akurasi > 50 m, tampilkan peringatan dan minta ulangi.
  - Jika izin lokasi ditolak, sediakan input manual lat/long + catatan alasan.
  - Tampilkan pratinjau peta (Leaflet + OpenStreetMap) agar interviewer bisa menggeser pin.
- **FR-15** **Nomor telepon:** validasi format Indonesia (08xx / +628xx), panjang 9–15 digit; simpan dalam format ternormalisasi.
- **FR-16** **Tanggal kunjungan:** default hari ini (WIB), tidak boleh tanggal masa depan, tidak boleh lebih dari 30 hari ke belakang (peringatan lunak).
- **FR-17** **Cuaca per jam:** empat field angka bulat 0–24 untuk cerah, mendung, gerimis, hujan.
  - Total ≤ 24 jam → error jika melebihi.
  - Total < 24 jam → boleh disimpan tetapi diberi tanda "belum lengkap".
  - Default: 0 pada semua field.
- **FR-18** **Penjualan per merek:** tabel dinamis (baris bisa ditambah/hapus) berisi merek + jumlah sachet terjual (integer ≥ 0).
  - **Definisi angka:** jumlah sachet merek tersebut yang **terjual pada hari kunjungan itu saja**
    (satu hari, 00.00–23.59 WIB). Angka ini **bukan** penjualan kumulatif dan **bukan**
    penjualan sejak kunjungan sebelumnya, sehingga nilainya tidak boleh > total penjualan harian
    warung tersebut pada hari itu.
  - Karena diambil pada satu titik waktu (saat interviewer datang), angka ini adalah
    **penjualan hingga jam kunjungan** — karena itu jam kunjungan wajib dicatat (FR-43).
  - Minimal 1 merek wajib diisi.
  - Merek duplikat dalam satu kunjungan ditolak.
  - Ada kolom catatan opsional per baris (mis. varian, harga, promo).
- **FR-19** Simpan sebagai satu transaksi database (warung + kunjungan + baris merek). Gagal sebagian = batal semua.
- **FR-20** Setelah simpan, tampilkan ringkasan dan tawarkan "Lanjut input warung baru".

### 5.4 Form Kunjungan Ulang

- **FR-21** Interviewer memilih warung dari daftar miliknya: pencarian nama warung, urut "terakhir dikunjungi", tampilkan alamat & tanggal kunjungan terakhir.
- **FR-22** Field pada kunjungan ulang: tanggal kunjungan (wajib), jam kunjungan (wajib),
  cuaca per jam (FR-17), jumlah sachet terjual per merek untuk **hari kunjungan itu saja** (FR-18).
- **FR-23** Merek dari kunjungan pertama **otomatis dimuat** (prefilled), nilai penjualan default kosong/0 dan wajib dikonfirmasi.
- **FR-24** Interviewer dapat menambah **merek baru** pada kunjungan ulang; merek baru tersebut otomatis menjadi bagian daftar merek warung untuk kunjungan berikutnya.
- **FR-25** Merek lama boleh bernilai 0 (artinya tidak ada penjualan pada periode itu), tetapi sistem menampilkan tanda "0 sachet" di ringkasan untuk validasi.
- **FR-26** Satu warung tidak boleh punya dua kunjungan pada tanggal yang sama; jika ada, tampilkan konfirmasi (edit kunjungan yang ada atau batalkan).
- **FR-27** Kunjungan ulang boleh mengubah data warung (mis. nomor telepon baru, koreksi koordinat) melalui tombol "Perbarui Info Warung", dengan jejak audit.

### 5.5 Dashboard Master Researcher

- **FR-28** Kartu ringkasan: jumlah warung, jumlah kunjungan, jumlah interviewer aktif, total sachet terjual, rata-rata sachet per warung, jumlah merek tercatat.
- **FR-29** Grafik: tren sachet per hari/minggu, komposisi penjualan per merek (top 10), sebaran penjualan per interviewer (Recharts).
- **FR-30** Tabel data kunjungan: kolom interviewer, warung, alamat, tanggal, cuaca, merek, sachet; pagination, sorting, pencarian.
- **FR-31** Filter: rentang tanggal, interviewer, warung, merek, kota/kecamatan (jika diisi).
- **FR-32** Peta sebaran warung (Leaflet) dengan marker per warung; klik marker → detail kunjungan.
- **FR-33** Drill-down: halaman detail warung menampilkan riwayat kunjungan dan tren penjualan per merek.
- **FR-34** Panel kualitas data: daftar kunjungan dengan anomali — total jam cuaca ≠ 24, penjualan 0 pada semua merek, koordinat akurasi buruk, merek duplikat, telepon tidak valid.
- **FR-35** Unduh data (lihat bagian 14) dalam format CSV dan XLSX.

### 5.6 Ketersimpanan & Offline

- **FR-36** Data disimpan di PostgreSQL di server; tidak ada data yang hanya hidup di browser.
- **FR-37** Draft form disimpan otomatis (autosave) ke IndexedDB setiap perubahan field, agar tidak hilang jika app tertutup/baterai habis.
- **FR-38** Saat offline, submission masuk ke **antrean lokal** dan ditandai `pending_sync`.
- **FR-39** Saat kembali online, antrean dikirim otomatis (background sync / saat app dibuka) dan status berubah menjadi `synced`.
- **FR-40** Setiap submission punya `client_uuid` (dibuat di perangkat) sebagai **idempotency key** sehingga sinkronisasi ulang tidak menghasilkan duplikasi data.
- **FR-41** Interviewer dapat melihat halaman "Status Sinkronisasi": daftar entri pending, gagal, dan sukses, plus tombol "Kirim Ulang".
- **FR-42** Batas retensi antrean lokal: data tetap tersimpan sampai server mengonfirmasi sukses; entri sukses boleh dibersihkan setelah 30 hari.

### 5.7 Definisi Metrik & Jam Kunjungan (hasil konfirmasi 10 Sep 2026)

- **FR-43** **Jam kunjungan wajib dicatat** pada setiap kunjungan (`visit_time`, jam:menit WIB,
  default = waktu perangkat saat form disimpan, dapat dikoreksi interviewer).
  - Alasan: angka "sachet terjual" adalah penjualan hari itu **hingga jam kunjungan**,
    sehingga jam kunjungan diperlukan analis untuk menafsirkan angka (pagi = sebagian hari).
  - Tampilkan pengingat di form: *"Catat penjualan HARI INI saja (hingga jam Anda sekarang),
    bukan total kumulatif."*
- **FR-44** **Label UI dan export wajib eksplisit.** Semua tempat yang menampilkan angka penjualan
  menggunakan label **"Sachet terjual hari ini (hingga jam kunjungan)"**, bukan hanya
  "sachet terjual", agar interviewer tidak salah tafsir.
- **FR-45** **Validasi rentang harian (peringatan lunak).** Bila total sachet semua merek pada
  satu kunjungan > 500 sachet, tampilkan konfirmasi: *"Total penjualan hari ini cukup besar
  untuk satu warung. Yakin angka ini penjualan hari ini, bukan kumulatif?"*
- **FR-46** **Kunjungan pada tanggal yang sama untuk warung yang sama** (FR-26) mengikuti kaidah
  satu hari satu data: bila sudah ada, interviewer diminta **memperbarui** kunjungan tersebut
  alih-alih membuat baris baru, supaya angka harian tidak terpecah/terhitung ganda.
- **FR-47** Analis (master) dapat melihat **kapan** sebuah angka diambil: kolom jam kunjungan
  ditampilkan di tabel dashboard dan disertakan pada export.

---

## 6. Model Data (Entitas Utama)

- **users** — akun interviewer & master
  - id (UUID), username (unik), password_hash, full_name, phone, role, region, is_active, created_by, created_at, updated_at, last_login_at
- **auth_log** — jejak login (username, success, ip, user_agent, created_at)
- **brands** — master merek (id, name unik, variant, category, is_active, created_by, created_at)
- **outlets** — warung
  - id (UUID), name, owner_name, address, phone, latitude, longitude, accuracy_m, geolocation_source (gps/manual), city, district, notes, created_by (interviewer), created_at, updated_at, is_deleted
  - Batasan: satu interviewer boleh punya banyak warung; warung unik per kombinasi (nama + telepon) untuk interviewer tersebut.
- **visits** — kunjungan
  - id (UUID), client_uuid (unik, idempotency), outlet_id, interviewer_id, visit_number, visit_date, visit_time, weather_clear_h, weather_cloudy_h, weather_drizzle_h, weather_rain_h, weather_total_h (generated), latitude, longitude, accuracy_m, notes, is_offline_created, synced_at, created_at, updated_at, is_deleted
  - Catatan: `visit_time` = jam kunjungan (WIB) — pembeda penting karena angka sachet adalah penjualan hari itu hingga jam tersebut.
  - Batasan: unik (outlet_id, visit_date).
- **visit_sales** — penjualan per merek per kunjungan
  - id, visit_id, brand_id (nullable jika merek baru), brand_name_snapshot, sachets_sold (int ≥ 0), variant_note, is_new_brand, created_at
  - Batasan: unik (visit_id, brand_name_snapshot normalized).
- **visit_photos** — opsional, foto warung/label merek (path storage, uploaded_at)
- **audit_trail** — perubahan penting (entity, entity_id, action, actor_id, before_json, after_json, created_at)

**Aturan umum**

- Semua PK memakai UUID v7; semua waktu disimpan `timestamptz` (UTC) dan ditampilkan WIB.
- Soft delete (`is_deleted`) untuk outlets & visits; data tidak pernah dihapus permanen oleh interviewer.
- Nama merek disimpan sebagai snapshot di `visit_sales` agar perubahan master merek tidak mengubah data historis.

---

## 7. Daftar Halaman & Endpoint

**Halaman**

- `/login` — login interviewer & master
- `/interviewer` — beranda: tombol "Warung Baru" & "Kunjungan Ulang", status sinkronisasi
- `/interviewer/warung/baru` — form kunjungan pertama
- `/interviewer/warung/[id]` — detail warung + riwayat kunjungan
- `/interviewer/warung/[id]/kunjungan/baru` — form kunjungan ulang
- `/interviewer/sinkronisasi` — antrean pending/gagal/sukses
- `/master` — dashboard ringkasan & grafik
- `/master/warungs` — daftar warung (filter, peta, drill-down)
- `/master/kunjungan` — tabel kunjungan
- `/master/interviewer` — kelola akun interviewer
- `/master/merek` — master daftar merek
- `/master/kualitas-data` — panel anomali
- `/master/export` — unduh CSV/XLSX
- `/api/health` — healthcheck untuk Railway

**API (REST/Server Actions)**

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST/PATCH /api/interviewers` (master only)
- `POST /api/interviewers/[id]/reset-password`
- `GET/POST /api/brands`
- `POST /api/outlets` — buat warung + kunjungan pertama (transaksional)
- `GET /api/outlets?mine=1&q=` — daftar warung milik interviewer
- `GET /api/outlets/[id]`
- `POST /api/visits` — kunjungan ulang (idempotent via `client_uuid`)
- `POST /api/sync/batch` — kirim antrean offline sekaligus
- `GET /api/master/summary`, `GET /api/master/visits`, `GET /api/master/anomalies`
- `GET /api/export?format=csv|xlsx&...filter` — streaming download

---

## 8. Requirement Teknologi (WAJIB)

### 8.1 Arsitektur

- **Monolith full-stack Next.js** (satu service) agar sederhana di-deploy dan murah di Railway: frontend + backend + API dalam satu repository.
- **Bahasa:** TypeScript (mode `strict`), target Node.js 20 LTS.
- **Rendering:** Next.js 15 App Router, React Server Components + Server Actions untuk mutasi, route handler untuk API publik.
- **Tidak memakai microservices, tidak memakai serverless terpisah** pada versi ini.

### 8.2 Frontend

- **Next.js 15** + **React 19**, TypeScript.
- **Tailwind CSS** untuk styling + **shadcn/ui** untuk komponen (Dialog, Table, Form, Toast).
- **Mobile-first**: layout dioptimalkan untuk layar 360–430 px; target sentuh minimal 44 px; font input minimal 16 px agar tidak auto-zoom di browser mobile.
- **Form:** React Hook Form + resolver **Zod** (skema dipakai bersama client & server).
- **Data client:** TanStack Query v5 untuk cache, retry, dan status offline.
- **Peta:** Leaflet + react-leaflet, tile OpenStreetMap (tanpa API key / tanpa biaya).
- **Grafik:** Recharts.
- **PWA:** manifest + service worker (Serwist / next-pwa) supaya bisa di-install ke home screen dan dibuka offline.

### 8.3 Database (WAJIB PostgreSQL di Railway)

- **PostgreSQL 16** sebagai database utama, dipasang sebagai **plugin Postgres di project Railway** (bukan SQLite, bukan MySQL, bukan MongoDB, bukan file JSON).
- **ORM: Prisma** — semua perubahan skema lewat `prisma migrate` (file migrasi di repo, dijalankan di pipeline deploy dengan `prisma migrate deploy`).
- **Koneksi:** gunakan `DATABASE_URL` (pooled, melalui PgBouncer Railway) untuk runtime dan `DIRECT_URL` untuk migrasi.
- **Indeks wajib:** `visits(outlet_id, visit_date)`, `visits(interviewer_id)`, `visit_sales(visit_id)`, `visit_sales(brand_id)`, `outlets(created_by)`, `visits(client_uuid)` unik.
- **Integritas:** foreign key + constraint di level DB (bukan hanya validasi aplikasi), `weather_total_h` sebagai generated column, check constraint `sachets_sold >= 0` dan `weather_*_h BETWEEN 0 AND 24`.
- **Transaksi:** pembuatan warung + kunjungan + baris penjualan dibungkus satu transaksi (`prisma.$transaction`).

### 8.4 Autentikasi

- **Auth.js (NextAuth v5)** dengan **Credentials Provider**, sesi JWT di cookie `httpOnly`, `sameSite=lax`, `secure` di produksi.
- Password di-hash dengan **bcrypt** (cost 12). Tidak ada penyimpanan password plaintext di mana pun.
- Middleware Next.js untuk proteksi route berdasarkan role (`MASTER_RESEARCHER`, `INTERVIEWER`).

### 8.5 Offline & Sinkronisasi

- **IndexedDB via Dexie.js** untuk draft form dan antrean submission.
- **Service worker** menyimpan app shell + asset statis; halaman form tetap dapat dibuka tanpa jaringan.
- **Idempotency:** setiap submission membawa `client_uuid`; server menolak duplikat dengan `ON CONFLICT DO NOTHING` / unique constraint.
- Sinkronisasi otomatis saat event `online` dan saat app dibuka; tampilkan indikator "online/offline" dan jumlah entri pending di header.

### 8.6 Export & Laporan

- **ExcelJS** untuk XLSX dan generator CSV bawaan Node (streaming, agar aman untuk puluhan ribu baris).
- Export dijalankan **server-side** dan diunduh langsung oleh Master Researcher (tidak membebani perangkat interviewer).

### 8.7 Kualitas Kode & Testing

- **ESLint + Prettier**, pre-commit hook (Husky + lint-staged) opsional.
- **Vitest** untuk unit test (validasi Zod, fungsi agregasi, aturan bisnis cuaca & penjualan).
- **Playwright** untuk e2e minimal: login, input kunjungan pertama, kunjungan ulang, export.
- Cakupan minimum: seluruh fungsi aturan bisnis di bagian 12 harus punya unit test.

### 8.8 Observability

- Logging terstruktur (**pino**) dengan request id.
- Error tracking **Sentry** (opsional, aktif via env var).
- Endpoint `/api/health` mengembalikan status DB + versi build, dipakai healthcheck Railway.

---

## 9. Requirement Non-Fungsional

- **NFR-01 Kinerja:** halaman form tampil < 2 detik pada koneksi 4G; query dashboard master < 3 detik untuk 100 ribu baris `visit_sales`.
- **NFR-02 Skala:** mendukung minimal 50 interviewer, 5.000 warung, 50.000 kunjungan, 500 ribu baris penjualan tanpa perubahan arsitektur.
- **NFR-03 Keandalan:** tidak ada kehilangan data — kombinasi penyimpanan server + antrean offline + autosave draft; target ketersediaan 99%.
- **NFR-04 Keamanan:** HTTPS wajib, cookie httpOnly, proteksi CSRF dari NextAuth, rate limit login, validasi input menyeluruh (Zod) di server.
- **NFR-05 Privasi:** data pemilik warung (nama & nomor telepon) bersifat terbatas — hanya master & interviewer pemilik data; tidak ada data pribadi responden konsumen yang dikumpulkan.
- **NFR-06 Usabilitas:** seluruh alur input kunjungan selesai dalam < 5 menit oleh interviewer terlatih; teks berbahasa Indonesia.
- **NFR-07 Kompatibilitas:** Chrome/Edge/Safari versi 2 tahun terakhir di Android & iOS; diuji minimal di Android mid-range.
- **NFR-08 Aksesibilitas:** kontras warna memadai, label eksplisit pada setiap input, pesan error jelas dan berbahasa Indonesia.
- **NFR-09 Audit:** setiap perubahan data tercatat (siapa, kapan, nilai sebelum/sesudah) untuk data warung & kunjungan.
- **NFR-10 Zona waktu:** semua waktu disimpan UTC, ditampilkan dan diinput dalam **Asia/Jakarta (WIB)**.

---

## 10. Deployment, GitHub & Railway

**Repository GitHub**

- Struktur: satu repo `retail-audit-sachet` (Next.js app di root, `prisma/` untuk skema & migrasi, `requirement.md` di root).
- Branch: `main` = produksi, `develop` = staging, `feature/*` untuk pekerjaan.
- Wajib ada: `README.md` (cara setup lokal, env vars, cara deploy), `.env.example`, `.gitignore` (jangan pernah commit `.env`).
- **GitHub Actions** (`.github/workflows/ci.yml`): install → lint → typecheck → unit test → `prisma validate` → build. PR tidak boleh merge jika CI merah.

**Railway**

- Satu project Railway berisi: service aplikasi (dari repo GitHub, auto-deploy saat push ke `main`) + plugin PostgreSQL.
- Konfigurasi: `railway.json` (build command, start command `npm run start`, healthcheck `/api/health`, restart policy). Nixpacks/Node 20.
- Variabel env yang diperlukan:
  - `DATABASE_URL` (pooled), `DIRECT_URL`
  - `AUTH_SECRET`, `NEXTAUTH_URL` / `APP_BASE_URL`
  - `SEED_MASTER_USERNAME`, `SEED_MASTER_PASSWORD` (hanya untuk seed awal)
  - `TZ=Asia/Jakarta`, `NODE_ENV=production`
  - `SENTRY_DSN` (opsional)
- Migrasi dijalankan otomatis saat deploy: `prisma migrate deploy` sebelum start.
- **Seed** membuat 1 akun Master Researcher pertama.
- **Backup:** aktifkan backup harian PostgreSQL Railway; tambahan cron mingguan `pg_dump` ke object storage (retensi 30 hari) bila diperlukan.
- Environment staging terpisah dengan database terpisah (opsional tetapi disarankan).

---

## 11. Aturan Validasi & Bisnis (ringkas)

- **VL-01** Total jam cuaca ≤ 24; > 24 = error; < 24 = tersimpan dengan flag "belum lengkap".
- **VL-02** `sachets_sold` integer 0–100.000; nilai > 5.000 per merek per kunjungan memicu konfirmasi "angka tidak wajar, yakin?".
- **VL-03** Telepon: regex Indonesia (opsional `+62`), panjang 9–15 digit.
- **VL-04** Koordinat: latitude −90..90, longitude −180..180; peringatan jika berada di luar bounding box Indonesia.
- **VL-05** Tanggal kunjungan ≤ hari ini (WIB) dan ≥ 2026-01-01.
- **VL-06** Satu kunjungan per warung per tanggal (unik di DB).
- **VL-07** Merek tidak boleh duplikat dalam satu kunjungan (perbandingan case-insensitive dan trim spasi).
- **VL-08** Minimal satu merek dengan data penjualan pada setiap kunjungan.
- **VL-09** Kunjungan ulang tidak boleh dibuat untuk warung yang bukan milik interviewer tersebut.
- **VL-10** **Angka sachet = penjualan hari kunjungan itu saja.** Sistem tidak boleh menerima angka
  kumulatif; tidak ada akumulasi otomatis antar kunjungan. Nilai setiap kunjungan berdiri sendiri
  (independen), sehingga tren dihitung dengan membandingkan angka antar tanggal kunjungan.
- **VL-11** Jam kunjungan wajib terisi dan berada dalam rentang 00:00–23:59 WIB; jika jam kunjungan
  lebih awal dari 04:00 atau setelah 23:00, tampilkan konfirmasi (kemungkinan salah input).

---

## 12. Export Data Tabular

Dua format, keduanya tersedia di `/master/export`:

- **Long format (default analisis):** satu baris per kombinasi kunjungan × merek.
  - Kolom: `interviewer_username`, `interviewer_name`, `outlet_id`, `warung`, `pemilik`, `alamat`, `telepon`, `latitude`, `longitude`, `accuracy_m`, `visit_number`, `tanggal_kunjungan`, `jam_kunjungan`, `jam_cerah`, `jam_mendung`, `jam_gerimis`, `jam_hujan`, `total_jam`, `merek`, `varian`, `sachet_terjual_hari_ini`, `is_merek_baru`, `catatan`, `sumber_data` (online/offline), `created_at`.
  - Definisi kolom `sachet_terjual_hari_ini`: penjualan merek tersebut **pada hari kunjungan itu saja, hingga jam kunjungan** (bukan kumulatif).
- **Wide format (untuk pivot cepat):** satu baris per kunjungan, kolom merek dibuat dinamis (mis. `Merek A (sachet hari ini)`, `Merek B (sachet hari ini)`).
- Filter export mengikuti filter dashboard (tanggal, interviewer, warung, merek).
- Nama file: `retail-audit-<format>-<YYYYMMDD-HHmm>.csv|xlsx`.
- **Time & date di WIB**, angka tanpa format ribuan, encoding UTF-8 (BOM untuk CSV agar rapi di Excel).

---

## 13. Kriteria Penerimaan (Acceptance Criteria)

- **AC-01** Master dapat membuat akun interviewer; interviewer dapat login dengan akun tersebut dan tidak bisa mengakses halaman master.
- **AC-02** Interviewer dapat menyelesaikan form kunjungan pertama lengkap dengan koordinat GPS yang tercatat benar dan tersimpan.
- **AC-03** Interviewer dapat memilih warung lama dan mengisi kunjungan ulang; merek dari kunjungan pertama muncul otomatis; merek baru dapat ditambahkan dan muncul pada kunjungan berikutnya.
- **AC-04** Form menolak total jam cuaca > 24 dan menandai total < 24 sebagai belum lengkap.
- **AC-05** Data kunjungan yang dibuat saat perangkat offline tetap tersimpan dan tersinkron otomatis saat kembali online, **tanpa duplikasi** meski tombol kirim ditekan berulang.
- **AC-06** Data yang sudah tersimpan tetap ada setelah pengguna reload/logout/login ulang dan setelah redeploy aplikasi.
- **AC-07** Master dapat memfilter data dan mengunduh CSV & XLSX; jumlah baris hasil export sesuai jumlah data yang diffilter.
- **AC-08** Dashboard menampilkan jumlah warung, kunjungan, total sachet, dan grafik per merek dengan angka yang konsisten dengan tabel.
- **AC-09** Peta menampilkan marker warung sesuai koordinat yang diinput.
- **AC-10** Halaman utama dapat dibuka dan form dapat diisi pada kondisi offline (PWA terpasang).
- **AC-11** Backup harian PostgreSQL aktif di Railway dan prosedur restore sudah diuji minimal sekali.
- **AC-12** Build sukses di GitHub Actions dan aplikasi berjalan di Railway melalui push ke `main`.
- **AC-13** Angka sachet yang diinput tersimpan sebagai **penjualan hari kunjungan itu saja** —
  tidak ada perhitungan akumulatif: dua kunjungan pada tanggal berbeda menghasilkan dua angka
  independen, dan jam kunjungan tersimpan serta tampil di dashboard dan export.

---

## 14. Milestone

- **Fase 1 — MVP (prioritas utama):** skema DB + migrasi, auth & manajemen akun, form kunjungan pertama, form kunjungan ulang, penyimpanan server, dashboard tabel + export CSV/XLSX, deploy Railway + CI GitHub.
- **Fase 2 — Lapangan keras:** PWA offline penuh (IndexedDB + service worker + sync batch + idempotency), geolokasi akurasi & peta, validasi lanjutan, status sinkronisasi.
- **Fase 3 — Insight:** dashboard grafik lengkap, peta sebaran, panel kualitas data, master merek, audit trail, backup terjadwal, Sentry.
- **Fase 4 (opsional):** foto warung/label merek, mode multi-studi, notifikasi WhatsApp/Telegram ke master saat kunjungan masuk.

---

## 15. Asumsi & Pertanyaan Terbuka

Mohon konfirmasi sebelum development dimulai:

1. ~~**Definisi "sachet terjual":**~~ **SUDAH DIKONFIRMASI (10 Sep 2026):** angka sachet terjual
   adalah penjualan **pada hari kunjungan itu saja** (daily sales), **bukan** kumulatif dan
   **bukan** penjualan sejak kunjungan sebelumnya. Karena diambil pada satu titik waktu, jam
   kunjungan wajib dicatat (FR-43) dan angka diinterpretasikan sebagai penjualan hari itu
   **hingga jam kunjungan**. Tidak ada akumulasi otomatis antar kunjungan.
2. **Kepemilikan warung:** apakah warung hanya boleh dikunjungi oleh interviewer yang mendaftarkannya, atau bisa dikunjungi ulang oleh interviewer lain? Diasumsikan **hanya oleh pendaftarnya**.
3. **Batasan jumlah responden:** berapa target warung & berapa kali kunjungan ulang (mis. 4 kunjungan per warung)?
4. **Harga & stok:** apakah perlu mencatat harga jual per sachet dan stok akhir, atau cukup volume terjual? Diasumsikan **cukup volume terjual**.
5. **Foto:** apakah perlu bukti foto warung? Diasumsikan **opsional di Fase 4**.
6. **Wilayah studi:** apakah ada pembagian wilayah/kota yang perlu dikelola master (untuk filter & penugasan)? Belum termasuk; dapat ditambahkan.
7. **Nama warung unik:** apakah boleh dua warung berbeda dengan nama sama di lokasi berbeda? Diasumsikan **boleh**, dibedakan oleh koordinat & pemilik.
