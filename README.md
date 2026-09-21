# Retail Audit Sachet

**Versi saat ini: 4.3** — versi yang sama juga ditampilkan di footer webapp (setiap halaman)
dan di respons `GET /api/health` (`version`). Lihat [Riwayat Revisi](#riwayat-revisi) untuk
catatan lengkap setiap perubahan sejak versi 1.0 dirilis.

Webapps untuk pelaksanaan studi **market research (retail audit)** pada warung kopi dan toko
kelontong yang menjual minuman sachet. Dipakai oleh dua peran:

- **Master Researcher** — mengelola akun interviewer, memantau dashboard, mengunduh data.
- **Interviewer** — melakukan kunjungan lapangan (kunjungan pertama & kunjungan ulang) dari gadget.

Spesifikasi lengkap ada di [`requirement.md`](./requirement.md). Dokumen ini berisi panduan
penggunaan dan panduan deployment.

---

## Daftar Isi

1. [Riwayat Revisi](#riwayat-revisi)
2. [Tumpukan Teknologi](#tumpukan-teknologi)
3. [Menjalankan di Lokal](#menjalankan-di-lokal)
4. [Panduan Penggunaan](#panduan-penggunaan)
5. [Deployment ke Railway](#deployment-ke-railway)
6. [Diagnostik Deployment (Health Check)](#diagnostik-deployment-health-check)
7. [Struktur Proyek](#struktur-proyek)
8. [Testing](#testing)
9. [Status Implementasi & Batasan](#status-implementasi--batasan)

---

## Riwayat Revisi

Semua perubahan pada aplikasi ini dicatat di sini secara kronologis (terbaru di atas). Nomor
versi mengikuti versi yang tampil di footer webapp dan `/api/health`.

### v4.3 — 21 September 2026

- **Interviewer & Master sekarang bisa mengedit tanggal kunjungan yang sudah tersimpan.**
  Sebelumnya field tanggal dikunci (`disabled`) di formulir edit Cuaca/Penjualan interviewer, dan
  di sisi Master perubahan tanggal yang bentrok selalu ditolak dengan error. Sekarang tanggal bisa
  diubah di kedua sisi. Karena satu warung hanya boleh punya satu baris kunjungan per tanggal
  (`@@unique([outletId, visitDate])`), bila tanggal baru yang dipilih sudah dipakai kunjungan lain
  milik warung yang sama, muncul **popup konfirmasi** ("Warung ini sudah punya kunjungan pada
  tanggal baru tersebut. Data kunjungan lama di tanggal itu akan digantikan. Lanjutkan?") sebelum
  data lama itu digantikan sepenuhnya (cuaca, penjualan, catatan, dan foto pada tanggal tersebut
  — baris lama dihapus permanen, bukan soft delete, karena kolom tanggal terikat *unique
  constraint*). Tanpa bentrok, tanggal langsung berpindah tanpa perlu konfirmasi tambahan. Master
  mencatat penggantian ini di `audit_trail` (`master_edit_visit_replace`, menyimpan id & isi
  kunjungan yang digantikan). Lihat `editRevisitWeather`/`editRevisitSales` di
  `src/lib/outlet-service.ts` dan `PATCH /api/master/visits/[id]`.

**Bug ditemukan & diperbaiki saat pengujian menyeluruh (browser, memakai Vibium) atas fitur di atas:**

- **Cache React Query yang tidak konsisten membuat edit tanggal bisa ter-*revert* diam-diam.**
  Halaman edit Formulir Cuaca (`/interviewer/warung/[id]/kunjungan/cuaca`) meng-query datanya
  sendiri dengan key `["outlet-basic", ...]`, tapi setelah submit hanya meng-invalidasi key
  `["outlet", ...]` (dipakai halaman lain) — bukan key miliknya sendiri. Akibatnya, membuka
  kembali "Edit Cuaca" untuk kunjungan yang sama tanpa reload penuh browser menampilkan data lama
  dari cache (termasuk tanggal sebelum diedit), dan submit berikutnya diam-diam menimpa balik
  perubahan tanggal yang baru saja tersimpan — ditemukan saat pengujian Vibium mereproduksi alur
  edit dua kali berturut-turut. Diperbaiki dengan menambahkan invalidasi
  `["outlet-basic", params.id]` di halaman tersebut.
- **Nomor kunjungan ("Kunjungan #N") bisa tabrakan setelah data lama dihapus akibat penggantian
  tanggal.** Nomor kunjungan baru dihitung dari `COUNT` baris yang masih aktif (`isDeleted:
  false`) + 1 — begitu penggantian tanggal (lihat di atas) menghapus sebuah baris, angka itu
  berkurang dan kunjungan berikutnya bisa memakai nomor yang sama dengan kunjungan lain yang masih
  ada, membuat dua kunjungan berbeda tampil dengan label identik ("Kunjungan #3" dua kali) di
  riwayat warung. Diperbaiki dengan menghitung nomor kunjungan berikutnya dari `MAX(visitNumber)`
  yang pernah dipakai warung tersebut (termasuk baris yang sudah dihapus), bukan `COUNT` baris
  aktif — lihat `nextVisitNumber()` di `src/lib/outlet-service.ts`.
- **(Bug lama, ditemukan tidak sengaja saat menguji fitur di atas) Kunjungan yang sudah
  di-*soft-delete* Master bisa "dihidupkan kembali" tanpa terlihat.** Kolom tanggal kunjungan
  unik di level database terlepas dari status `is_deleted`, jadi baris yang sudah dihapus Master
  tetap "menghuni" tanggal itu. Bila interviewer lalu mengirim data baru untuk tanggal yang sama
  (formulir Cuaca/Penjualan, alur timpa-data biasa — bukan fitur edit-tanggal di atas), aplikasi
  menulis ke baris lama itu tapi tidak pernah mengembalikan `is_deleted` ke `false` — submit
  tampak berhasil ("Data tersimpan"), padahal datanya tetap tersembunyi selamanya dari dashboard,
  daftar kunjungan, dan export. Diperbaiki dengan men-set `isDeleted: false` eksplisit setiap kali
  menimpa baris yang ditemukan lewat kombinasi warung+tanggal, di kedua alur
  (`submitRevisitWeather`/`submitRevisitSales`).

Diverifikasi lewat browser (Vibium): edit tanggal interviewer (Cuaca & Penjualan) tanpa bentrok
maupun dengan bentrok + konfirmasi + verifikasi data lama benar-benar tergantikan di database,
tombol "Batal" pada popup konfirmasi tidak mengubah apa pun, edit tanggal Master dengan & tanpa
bentrok, tanggal di luar rentang valid ditolak dengan pesan jelas (bukan *crash*), hapus kunjungan
(Master), serta halaman Dashboard/Warung/Kualitas Data/Export tetap menampilkan data yang benar
setelah rangkaian pengujian di atas.

### v4.2 — 21 September 2026

- **Interviewer bisa melampirkan foto (PNG/JPEG) di Formulir Cuaca dan Formulir Merek &
  Penjualan.** Maksimal 3 foto per submit, masing-masing maksimal 5MB — foto di-downscale dan
  dikompres di browser (maks sisi terpanjang 1600px, JPEG kualitas 0.8, lihat
  `src/lib/image-compress.ts`) sebelum dikirim, supaya hemat kuota data lapangan dan ukuran
  penyimpanan server. Foto disimpan sebagai `bytea` langsung di Postgres (bukan path filesystem)
  karena disk Railway bersifat *ephemeral* dan proyek ini belum punya object storage terpisah
  (model `VisitPhoto`, migrasi `20260921032633_visit_photos_binary_storage`). Foto bersifat
  **tambahan (append-only)**: submit ulang formulir yang sama (edit atau timpa data tanggal yang
  sama) tidak pernah menghapus foto yang sudah tersimpan sebelumnya — hanya menambahkan foto baru
  bila interviewer melampirkan lagi. Lampiran foto ikut lewat payload JSON yang sama dipakai
  jalur online maupun antrean offline (Dexie), jadi tetap berfungsi tanpa koneksi.
- **Master bisa melihat & mengunduh foto lampiran** di halaman detail/edit kunjungan
  (`/master/kunjungan/[id]`) — thumbnail dikelompokkan per formulir asal (Cuaca / Merek &
  Penjualan) dengan tautan "Unduh". Byte gambar diambil lewat endpoint terpisah
  (`GET /api/master/visits/[id]/photos/[photoId]`, opsional `?download=1` untuk memaksa unduh)
  supaya payload detail kunjungan (`GET /api/master/visits/[id]`) tetap ringan (hanya metadata:
  nama file, tipe, ukuran, waktu unggah).

### v4.0 — 19 September 2026

- **Field baru "Catatan / komentar" (opsional) di Formulir Cuaca.** Sebelumnya field catatan
  bebas hanya ada di Formulir Merek & Penjualan (`visitNotes`). Sekarang Formulir Cuaca
  (`/interviewer/warung/[id]/kunjungan/cuaca`) juga punya field yang sama, dan label field yang
  sudah ada di Formulir Merek & Penjualan diseragamkan jadi "Catatan / komentar (opsional)".
  Keduanya menulis ke kolom `visits.notes` yang **sama** (satu kunjungan = satu catatan,
  disimpan bersama data cuaca ATAU penjualan — mana pun yang disubmit lebih dulu untuk tanggal
  itu, lihat penjelasan dua-formulir-independen di v2.5). Supaya catatan yang sudah diisi lewat
  satu formulir tidak tertimpa kosong saat formulir yang satunya disubmit di hari yang sama,
  kedua formulir kini mengambil-alih (prefill) catatan yang sudah tersimpan untuk tanggal
  kunjungan yang sama sebelum interviewer mulai mengisi. Tidak ada perubahan skema database
  (kolom `notes` sudah ada sejak awal).

### v3.1 — 16 September 2026

Perbaikan alur interviewer, atas laporan bahwa beberapa interviewer keburu menekan tombol
simpan sebelum sempat memverifikasi isian formulir:

- **Interviewer kini bisa mengedit data warung & kunjungan yang sudah pernah diinput sendiri**
  (sebelumnya koreksi hanya bisa dilakukan oleh Master Researcher):
  - Tombol **"✏️ Edit"** di halaman detail warung (`/interviewer/warung/[id]`) membuka formulir
    untuk mengoreksi data warung (nama, pemilik, alamat, telepon, kota/kecamatan, jam
    buka/tutup, catatan, lokasi) — hanya untuk warung milik interviewer yang bersangkutan
    (`PATCH /api/outlets/[id]` kini juga menerima peran INTERVIEWER, dibatasi ke warung yang
    dia buat sendiri; Master Researcher tetap bisa mengedit semua warung seperti sebelumnya).
  - Setiap baris **Riwayat Kunjungan** yang sudah terisi kini punya tombol **"✏️ Edit Cuaca"**
    dan/atau **"✏️ Edit Penjualan"** yang membuka kembali Formulir Cuaca / Formulir Merek &
    Penjualan **dengan data yang sudah tersimpan terisi otomatis** (bukan formulir kosong),
    siap dikoreksi lalu disimpan langsung ke kunjungan yang sama. Tanggal kunjungan tidak bisa
    diubah lewat mode edit ini (mencegah baris kunjungan baru tercipta secara tidak sengaja) —
    ubah tanggal kunjungan tetap lewat Master Researcher bila diperlukan.
- **Pop-up konfirmasi sebelum menyimpan.** Semua formulir interviewer (Warung Baru, Edit Info
  Warung, Formulir Cuaca, Formulir Merek & Penjualan) kini menampilkan pop-up "Apakah Anda
  yakin data yang dimasukkan sudah benar?" tepat setelah validasi isian lolos dan sebelum data
  benar-benar tersimpan. Memilih **Ya** melanjutkan proses simpan (termasuk konfirmasi khusus
  lain seperti jam kunjungan tidak wajar/akurasi GPS rendah bila relevan); memilih **Tidak**
  menutup pop-up tanpa menyimpan apa pun sehingga interviewer bisa memeriksa ulang isian
  formulirnya.

### v2.5 — 13 September 2026

Perubahan alur pengisian formulir interviewer, atas permintaan pemilik produk:

- **Kunjungan pertama kini hanya mendata warung.** Form **Warung Baru**
  (`/interviewer/warung/baru`) tidak lagi menanyakan cuaca maupun merek/sachet — hanya data
  warung (nama, pemilik, alamat, telepon, kota/kecamatan, jam buka/tutup, catatan) + lokasi GPS
  + tanggal registrasi. Data cuaca dan penjualan merek baru mulai diisi pada kunjungan ke-2 dan
  seterusnya.
- **Kunjungan ke-2 dst kini dua formulir independen, bukan satu formulir gabungan.** Sebelumnya
  cuaca dan penjualan merek/sachet diisi dalam satu form sekaligus (`/kunjungan/baru`). Sekarang
  dipecah menjadi:
  - **Formulir Cuaca** (`/interviewer/warung/[id]/kunjungan/cuaca` → `POST /api/visits/weather`)
    — tanggal kunjungan + empat kondisi cuaca dalam jam.
  - **Formulir Merek & Penjualan** (`/interviewer/warung/[id]/kunjungan/penjualan` →
    `POST /api/visits/sales`) — tanggal & jam kunjungan, daftar merek + sachet terjual, catatan
    kunjungan, dan opsi "Perbarui Info Warung" (koordinat).

  Keduanya **disubmit terpisah** (masing-masing punya tombol simpan sendiri) dan bisa diisi di
  waktu yang berbeda — satu-satunya field yang sama-sama muncul di kedua formulir adalah
  **tanggal kunjungan**. Formulir mana pun yang disubmit lebih dulu untuk sebuah tanggal akan
  membuat baris kunjungan baru (bernomor urut seperti biasa); formulir yang menyusul untuk
  tanggal yang sama melengkapi baris yang sama, bukan membuat baris kedua (tetap menjaga VL-06:
  satu warung, satu baris kunjungan per tanggal). Bila formulir yang sama disubmit dua kali untuk
  tanggal yang sama (mis. cuaca disubmit ulang padahal sudah pernah diisi), sistem meminta
  konfirmasi menimpa data yang sudah ada — sama seperti perilaku duplikat-tanggal sebelumnya.
  - **Perubahan skema database:** `visits.visit_time` dan keempat kolom cuaca
    (`weather_clear_h/cloudy_h/drizzle_h/rain_h`) menjadi *nullable* — `null` berarti formulir
    terkait belum disubmit untuk kunjungan itu (lihat migrasi
    `20260913153507_split_weather_sales_nullable`). Kolom generated `weather_total_h` yang sudah
    tidak terpakai sejak v1.5 turut dibersihkan.
  - **Dashboard & data quality Master mengikuti perubahan ini:** tabel Kunjungan
    (`/master/kunjungan`), detail warung (`/master/warungs/[id]`), dan Panel Kualitas Data
    (`/master/kualitas-data`) sekarang menampilkan badge **"Cuaca belum diisi"** /
    **"Penjualan belum diisi"** untuk kunjungan yang baru terisi salah satu bagiannya —
    dibedakan dari kunjungan pertama (registrasi warung) yang memang tidak pernah mengisi
    keduanya. Export (long & wide format) tetap menyertakan kunjungan yang baru terisi cuacanya
    saja (kolom merek/sachet dikosongkan, bukan baris yang hilang).
  - Form edit Master (`/master/kunjungan/[id]`) tidak berubah (tetap satu form gabungan
    cuaca+penjualan untuk mengoreksi data), namun sekarang boleh menyimpan tanpa baris merek
    (untuk kunjungan yang baru punya data cuaca) dan menampilkan peringatan bila kunjungan yang
    dibuka belum lengkap.
- **Nomor telepon warung kini diisi bebas, tidak lagi divalidasi format Indonesia.**
  Sebelumnya nomor telepon pemilik warung (form Warung Baru & "Edit Info Warung" Master) wajib
  mengikuti format Indonesia (08xx/+628xx, 9–15 digit) dan dinormalisasi ke `+62xxxxxxxxxx` saat
  disimpan. Interviewer di lapangan bisa saja bertemu nomor yang tidak sesuai pola itu (nomor
  lama, nomor luar negeri, atau pemilik yang hanya punya nomor WhatsApp dengan format berbeda),
  sehingga validasi ini dilonggarkan sepenuhnya: field tetap wajib diisi (tidak boleh kosong),
  tapi tidak ada lagi pengecekan format atau normalisasi — nomor disimpan persis seperti yang
  diketik. Panel Kualitas Data (`/master/kualitas-data`) tidak lagi menandai "nomor telepon tidak
  valid" sebagai anomali. Modul `src/lib/phone.ts` (validasi & normalisasi format Indonesia) sudah
  tidak dipakai di mana pun dan dihapus.

### v1.5 — 10 September 2026

Perubahan aturan bisnis dan penambahan data warung, atas permintaan pemilik produk:

- **Jam cuaca tidak lagi wajib berjumlah 24 jam.** Sebelumnya total empat kondisi cuaca (cerah/
  mendung/gerimis/hujan) dibatasi maksimal 24 jam (error bila lebih) dan ditandai "belum lengkap"
  bila kurang dari 24 jam (VL-01 pada `requirement.md`). Aturan ini dilonggarkan sepenuhnya:
  interviewer bebas mengisi sesuai kondisi yang benar-benar teramati, tanpa keharusan totalnya
  mencapai 24 jam. Batas per-kondisi (0–24 jam masing-masing, karena satu kondisi tidak mungkin
  melebihi 24 jam dalam sehari) tetap berlaku, di aplikasi maupun sebagai *check constraint* di
  database. Panel Kualitas Data (`/master/kualitas-data`) juga disesuaikan — hanya menandai bila
  total jam cuaca **melebihi** 24 jam (tetap mustahil secara fisik), bukan lagi setiap kali
  totalnya bukan tepat 24.
- **Field baru: Jam Buka & Jam Tutup Warung.** Ditambahkan ke form **Warung Baru** (kunjungan
  pertama) sebagai input wajib, disimpan di level warung (`outlets.opening_time`,
  `outlets.closing_time` — bukan per-kunjungan, karena sifatnya data umum warung). Ditampilkan di
  halaman detail warung (interviewer & master) dan dapat dikoreksi Master lewat "Edit Info
  Warung". Turut ditambahkan sebagai kolom `jam_buka`/`jam_tutup` pada export long & wide format.
  Kolom database bersifat nullable agar data warung yang sudah ada sebelum v1.5 tidak perlu diisi
  ulang secara paksa.

**Bug ditemukan & diperbaiki saat pengujian menyeluruh (browser, memakai Vibium):**

- **Jumlah warung/kunjungan ikut menghitung data yang sudah dihapus (soft delete).** Kartu
  "Warung"/"Kunjungan" pada `/master/warungs`, `/master/interviewer`, dan daftar warung
  interviewer memakai `_count` Prisma yang tidak memfilter `is_deleted` — akibatnya sebuah warung
  yang satu-satunya kunjungan sudah di-*soft delete* Master tetap menampilkan "1 kunjungan",
  padahal seharusnya "0". Diperbaiki dengan memberi klausa `where: { isDeleted: false }` pada
  setiap `_count.select` terkait (`src/app/api/outlets/route.ts`,
  `src/app/api/interviewers/route.ts`).
- **Halaman edit tersangkut selamanya di "Memuat..." bila datanya tidak ditemukan.** Tiga halaman
  (`/master/kunjungan/[id]`, `/master/warungs/[id]`, `/interviewer/warung/[id]/kunjungan/baru`)
  memakai kondisi `isLoading || !data` untuk menentukan kapan menampilkan "Memuat..." — begitu
  request gagal (mis. kunjungan/warung sudah dihapus, atau tautan salah), `isLoading` menjadi
  `false` tapi `data` tetap `undefined`, sehingga kondisi itu tetap bernilai benar dan halaman
  terjebak menampilkan "Memuat..." tanpa henti alih-alih pesan error. Diperbaiki dengan
  memisahkan status `isLoading` dari `isError`, menampilkan pesan "tidak ditemukan" yang jelas
  beserta tautan kembali, dan menonaktifkan retry otomatis TanStack Query (`retry: false`) untuk
  query-query ini agar pesan error tidak tertunda oleh percobaan ulang yang sia-sia.

**Ronde pengujian kedua (Vibium) — tombol "Edit" bersarang tidak valid secara HTML:**

- Empat tempat (tabel kunjungan, riwayat kunjungan di halaman warung, halaman sukses kunjungan
  pertama, tombol "+ Kunjungan Ulang") merender `<Link><Button>...</Button></Link>`, yang
  menghasilkan `<button>` di dalam `<a>` — elemen interaktif bersarang yang tidak valid menurut
  spesifikasi HTML dan berisiko memicu *hydration mismatch* di React. Diperbaiki dengan
  mengekspor `buttonClassNames()` dari `src/components/ui/button.tsx` (kelas Tailwind yang sama
  dipakai `<Button>`) dan memakainya langsung pada `<Link>` di keempat tempat tersebut, sehingga
  hanya ada satu elemen interaktif (`<a>`) per tombol-tautan, tanpa mengubah tampilan sama sekali.
  Diverifikasi: `document.querySelectorAll("a button").length` kembali ke `0` di seluruh halaman
  yang diperbaiki, navigasi & gaya tombol tetap identik.
- Selain itu, dilakukan pengujian ulang penuh lewat browser (Vibium): alur login gagal & akun
  nonaktif, tambah/reset-password/nonaktifkan interviewer, tambah merek, hapus kunjungan (lewat
  UI, bukan API langsung), dan pengiriman penuh form Warung Baru (termasuk validasi wajib jam
  buka/tutup warung) — semuanya berjalan sesuai harapan tanpa ditemukan bug baru.

---

### v1.0 — 10 September 2026

Rilis awal: implementasi penuh Fase 1 (MVP) dan sebagian besar Fase 2–3 dari `requirement.md`
(autentikasi & RBAC, form kunjungan pertama & ulang, dashboard, export, offline sync — lihat
[Status Implementasi & Batasan](#status-implementasi--batasan) untuk rincian lengkap), diikuti
beberapa perbaikan stabilisasi pada hari yang sama:

- **Perbaikan alur login lintas akun** — navigasi setelah login diganti dari `router.push` (SPA)
  menjadi navigasi penuh (`window.location.assign`). Sebelumnya, saat berganti akun di browser
  yang sama (mis. dari Master ke Interviewer), cache navigasi klien Next.js bisa menyajikan
  tujuan redirect akun sebelumnya alih-alih akun yang baru login.
- **Health check diperkaya jadi diagnostik bertahap** (`GET /api/health`) — sebelumnya hanya
  mengecek koneksi database, sekarang mengembalikan status terpisah untuk `app` (proses berjalan),
  `env` (variabel wajib tersedia), `database` (konektivitas + latensi), dan `migrations` (skema
  sudah diterapkan). Tujuannya: saat deployment bermasalah, langsung terlihat apakah penyebabnya
  di sisi aplikasi atau database. Lihat [Diagnostik Deployment](#diagnostik-deployment-health-check).
- **Perbaikan build Railway (`EBUSY`)** — `railway.json` semula memakai `npm ci`, yang menghapus
  total folder `node_modules` sebelum instalasi ulang. Ini bentrok dengan cache build persisten
  Railway yang di-mount tepat di `node_modules/.cache`, menyebabkan build gagal dengan
  `EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'`. Build command diganti
  menjadi `npm install --include=dev && npm run build` (instal di tempat, tidak menghapus folder,
  dan memastikan devDependencies seperti TypeScript/Tailwind/ESLint tetap terpasang meski Railway
  mengatur konfigurasi npm "production" saat build).
- **GitHub Actions CI (`ci.yml`) dihapus** atas permintaan eksplisit pemilik proyek — token GitHub
  yang dipakai untuk push tidak memiliki scope `workflow`, sehingga push ditolak setiap kali
  `.github/workflows/ci.yml` ikut ter-commit. Proyek ini sengaja **tidak** memakai GitHub Actions;
  jalankan `npm run lint`, `npm run typecheck`, `npm run test`, dan `npm run build` secara manual
  sebelum push (lihat [Testing](#testing)). Auto-deploy Railway tetap berjalan normal tanpa CI ini
  — keduanya adalah mekanisme terpisah (lihat [Deployment ke Railway](#deployment-ke-railway)).
- **Versi "1.0" ditambahkan sebagai footnote** di setiap halaman webapp (`src/components/app-footer.tsx`)
  dan pada respons `/api/health`, bersumber dari satu konstanta di `src/lib/version.ts`.
- **Perbaikan crash total akibat `NEXTAUTH_URL` tanpa skema** — pada deploy pertama di Railway,
  seluruh aplikasi (termasuk `/api/health` sendiri) mengembalikan 500 karena `NEXTAUTH_URL`/
  `APP_BASE_URL` diisi tanpa `https://` (mis. disalin langsung dari domain Railway apa adanya:
  `retailaudit-production.up.railway.app`). Auth.js memanggil `new URL(...)` dengan nilai itu di
  middleware pada **setiap** request, dan tanpa skema itu melempar `TypeError: Invalid URL` —
  sebelum kode kita sendiri sempat berjalan. Ditambahkan normalisasi defensif di `src/auth.ts`
  yang otomatis menambahkan `https://` bila `AUTH_URL`/`NEXTAUTH_URL` tidak berawalan `http(s)://`,
  disertai log peringatan, sehingga satu env var yang salah ketik tidak lagi menjatuhkan seluruh
  aplikasi. **Env var tetap harus diisi dengan skema penuh** (`https://domain-anda`) — perbaikan
  ini hanya jaring pengaman, bukan pengganti konfigurasi yang benar.
- **Tambahan `npm run reset-master-password`** — `prisma/seed.ts` hanya membuat akun master bila
  belum ada, sehingga bila skrip seed sempat dijalankan sekali dengan `SEED_MASTER_PASSWORD` yang
  belum final (mis. masih memakai fallback `ChangeMe123!`), menjalankannya lagi setelah env var
  diperbaiki **tidak** memperbarui password yang tersimpan — inilah yang menyebabkan login gagal
  padahal env var sudah terlihat benar. Skrip baru `prisma/reset-master-password.ts` selalu
  menimpa password akun master ke nilai `SEED_MASTER_PASSWORD` saat ini (dan mengaktifkan kembali
  akun bila nonaktif), untuk kasus ini maupun lupa password di kemudian hari.
- **Fitur: Master dapat mengedit & menghapus data interviewer** — sebelumnya Master hanya bisa
  melihat data hasil kunjungan tanpa bisa mengoreksinya. Ditambahkan:
  - `PATCH /api/outlets/[id]` + tombol **"Edit Info Warung"** di `/master/warungs/[id]` — Master
    mengoreksi data warung (nama, pemilik, alamat, telepon, kota/kecamatan, catatan, koordinat).
  - `GET/PATCH/DELETE /api/master/visits/[id]` + halaman `/master/kunjungan/[id]` — Master
    mengoreksi tanggal/jam kunjungan, cuaca, dan penjualan per merek pada satu baris kunjungan,
    atau menghapusnya (**soft delete** via `is_deleted`, konsisten dengan desain penyimpanan di
    bagian 6 requirement — data tidak pernah dihapus permanen, hanya disembunyikan dari
    dashboard/grafik/tabel/export). Tombol Edit/Hapus tersedia di tabel `/master/kunjungan` dan
    di riwayat kunjungan pada halaman detail warung.
  - Kedua endpoint dibatasi role `MASTER_RESEARCHER` dan mencatat setiap perubahan ke
    `audit_trail` (nilai sebelum/sesudah, aktor, waktu) sesuai NFR-09.

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
| Deployment | Railway (Nixpacks, plugin PostgreSQL), auto-deploy dari GitHub — tanpa CI otomatis (lihat [Riwayat Revisi](#riwayat-revisi)) |

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
| `npm run seed` | Jalankan seed akun master + master merek (hanya membuat, tidak menimpa akun yang sudah ada) |
| `npm run reset-master-password` | Paksa reset password akun master ke `SEED_MASTER_PASSWORD` saat ini (juga mengaktifkan akun) |

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
   riwayat kunjungan dan tren penjualan per merek (drill-down). Tombol **"Edit Info Warung"** di
   halaman detail memungkinkan Master mengoreksi data warung yang diinput interviewer (nama,
   pemilik, alamat, telepon, kota/kecamatan, jam buka/tutup warung, catatan, koordinat).
6. **Kunjungan** (`/master/kunjungan`) — tabel seluruh kunjungan dengan pagination. Setiap baris
   punya tombol **Edit** (mengoreksi tanggal/jam kunjungan, cuaca, dan penjualan per merek yang
   diinput interviewer) dan **Hapus** (soft delete — kunjungan disembunyikan dari dashboard,
   grafik, tabel, dan export, tapi tetap tersimpan di database untuk jejak audit, sesuai NFR-09).
   Aksi yang sama juga tersedia di riwayat kunjungan pada halaman detail warung. Setiap
   edit/hapus oleh Master tercatat di `audit_trail` (siapa, kapan, nilai sebelum/sesudah).
7. **Kualitas Data** (`/master/kualitas-data`) — daftar kunjungan dengan anomali: total jam
   cuaca > 24, penjualan 0 sachet di semua merek, akurasi GPS buruk, merek duplikat, cuaca/
   penjualan belum diisi, atau total penjualan > 500 sachet dalam satu kunjungan (kemungkinan
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
2. **Warung Baru** (kunjungan pertama, `/interviewer/warung/baru`) — **hanya mendata warung**:
   nama, pemilik, alamat, telepon, kota/kecamatan, **jam buka & jam tutup warung**, catatan, lokasi
   GPS (tombol "📍 Ambil Lokasi" atau geser pin di peta / ketuk lokasi baru untuk koreksi manual),
   dan tanggal registrasi. **Tidak ada pertanyaan cuaca atau merek/sachet di sini** — itu baru
   muncul mulai kunjungan ke-2.
3. **Kunjungan Ulang** — pilih warung dari daftar warung yang pernah Anda input (bisa dicari), lalu
   pilih salah satu dari dua formulir terpisah di halaman detail warung:
   - **🌦️ Isi Data Cuaca** — tanggal kunjungan + kondisi cuaca dalam jam (isi sesuai yang benar-benar
     teramati — **tidak wajib berjumlah 24 jam**).
   - **🥤 Isi Data Penjualan** — tanggal & jam kunjungan, daftar merek + jumlah sachet **terjual
     hari itu saja** (merek dari kunjungan sebelumnya otomatis dimuat — konfirmasi ulang
     angkanya, boleh 0 bila tidak ada penjualan hari itu; Anda bisa menambah merek baru), catatan
     kunjungan, dan opsi "Perbarui koordinat" bila lokasi warung perlu dikoreksi.

   Kedua formulir **disubmit terpisah** dan boleh diisi kapan saja/dalam urutan apa pun — tidak
   perlu keduanya diisi sekaligus dalam satu sesi. Satu-satunya kolom yang sama-sama muncul di
   keduanya adalah **tanggal kunjungan**; formulir mana pun yang Anda simpan lebih dulu untuk
   tanggal tertentu akan mencatat kunjungan itu, dan formulir yang menyusul (untuk tanggal yang
   sama) akan melengkapinya, bukan membuat data kunjungan baru.
4. Sistem akan meminta **konfirmasi tambahan** (bukan menolak) bila: jam kunjungan di luar
   04:00–23:00, total penjualan satu kunjungan > 500 sachet, atau akurasi GPS > 50 m — ini untuk
   membantu Anda menghindari salah input, bukan untuk memblokir pekerjaan Anda.
5. Bila salah satu formulir (cuaca **atau** penjualan) sudah pernah diisi untuk tanggal yang sama,
   sistem akan menawarkan untuk **memperbarui** data itu alih-alih membuat data baru (satu warung =
   satu baris kunjungan per hari, meski cuaca & penjualannya diisi di waktu yang berbeda).
6. **Sebelum data tersimpan, akan selalu muncul pop-up konfirmasi** "Apakah Anda yakin data yang
   dimasukkan sudah benar?" — pilih **Ya** untuk melanjutkan penyimpanan, atau **Tidak** untuk
   menutup pop-up dan memeriksa ulang isian formulir tanpa kehilangan data yang sudah diketik.
7. **Mengedit data yang sudah tersimpan (v3.1)** — bila keburu menekan simpan sebelum sempat
   memverifikasi, data yang sudah tersimpan tetap bisa dikoreksi sendiri lewat halaman detail
   warung (`/interviewer/warung/[id]`):
   - Tombol **"✏️ Edit"** di kartu info warung mengoreksi data warung (nama, pemilik, alamat,
     telepon, kota/kecamatan, jam buka/tutup, catatan, lokasi).
   - Tombol **"✏️ Edit Cuaca"** / **"✏️ Edit Penjualan"** pada setiap baris di Riwayat Kunjungan
     membuka kembali formulir terkait dengan data yang sudah tersimpan **terisi otomatis**, siap
     dikoreksi dan disimpan ke kunjungan yang sama (tanggal kunjungan tidak bisa diubah lewat
     mode edit ini).
8. **Status Sinkronisasi** (`/interviewer/sinkronisasi`) — pantau data yang masih menunggu
   dikirim (misalnya karena sinyal lemah/offline saat submit). Data tersimpan otomatis secara
   lokal dan akan tersinkron sendiri saat koneksi kembali; Anda juga bisa menekan "Kirim Ulang".
9. Form yang sedang diisi **tersimpan otomatis sebagai draft** di perangkat Anda — aman bila
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
   - Build: `npm install --include=dev && npm run build` (termasuk `prisma generate`). Sengaja
     memakai `npm install`, **bukan** `npm ci` — `npm ci` menghapus total `node_modules` sebelum
     instal ulang, yang bentrok dengan cache build persisten Railway di `node_modules/.cache`
     (lihat [Riwayat Revisi](#riwayat-revisi)). Flag `--include=dev` memastikan devDependencies
     (TypeScript, Tailwind, ESLint) tetap terpasang untuk keperluan build.
   - Start: `npx prisma migrate deploy && npm run start` — migrasi database dijalankan otomatis
     sebelum aplikasi start setiap kali deploy.
   - Healthcheck: `/api/health` — diagnostik bertahap (app/env/database/migrasi), lihat
     [Diagnostik Deployment](#diagnostik-deployment-health-check).

6. **Deploy.** Railway akan build & jalankan otomatis. Pantau log build untuk memastikan
   `prisma migrate deploy` sukses.

7. **Jalankan seed akun master pertama** (sekali saja, setelah deploy pertama sukses). Dari tab
   *Shell* service di Railway (atau `railway run` via Railway CLI dari lokal):

   ```bash
   npm run seed
   ```

   Ini membuat satu akun `MASTER_RESEARCHER` menggunakan `SEED_MASTER_USERNAME` /
   `SEED_MASTER_PASSWORD` yang sudah diatur di langkah 4.

   > **Penting:** `npm run seed` hanya membuat akun bila **belum ada** akun dengan username
   > tersebut — bila sudah pernah dijalankan sebelumnya (mis. sebelum `SEED_MASTER_PASSWORD`
   > final diatur), menjalankannya lagi **tidak** akan memperbarui password. Tidak bisa login
   > padahal `SEED_MASTER_USERNAME`/`SEED_MASTER_PASSWORD` sudah benar? Jalankan ini untuk
   > memaksa reset password akun master ke nilai env var saat ini (juga mengaktifkan kembali
   > akun bila tidak sengaja nonaktif):
   >
   > ```bash
   > npm run reset-master-password
   > ```

8. **Login** ke URL produksi dengan akun master tersebut, lalu mulai buat akun interviewer dari
   menu **Kelola Interviewer**.

### Auto-deploy (tanpa CI otomatis)

- Setiap push ke `main` langsung memicu **Railway** untuk build & deploy ulang (webhook GitHub
  bawaan Railway, terpasang saat repo dihubungkan ke project Railway). Ini berjalan independen
  dari mekanisme CI apa pun.
- Proyek ini **sengaja tidak** memakai GitHub Actions/CI otomatis (lihat
  [Riwayat Revisi](#riwayat-revisi) untuk alasannya — token push yang dipakai tidak punya scope
  `workflow`, dan pemilik proyek memutuskan untuk tidak menambahkannya kembali). Konsekuensinya:
  **jalankan pengecekan secara manual sebelum push** — lint, typecheck, unit test, dan build tidak
  divalidasi otomatis di GitHub, sehingga commit yang rusak bisa saja langsung sampai ke Railway:

  ```bash
  npm run lint && npm run typecheck && npm run test && npm run build
  ```

  Bila suatu saat ingin mengaktifkan CI kembali, tambahkan file workflow lewat GitHub web UI
  (bukan lewat push dari token tanpa scope `workflow`) atau gunakan token dengan scope tersebut.

### Backup

- Aktifkan **backup harian** PostgreSQL bawaan Railway (tab *Backups* pada plugin Postgres).
- Uji **prosedur restore** minimal sekali sebelum studi berjalan penuh (AC-11), mis. restore ke
  environment staging terpisah.

### Environment staging (opsional, disarankan)

Buat environment Railway kedua (`develop`) dengan plugin PostgreSQL terpisah, terhubung ke
branch `develop`, agar perubahan bisa diuji sebelum masuk `main`/produksi.

---

## Diagnostik Deployment (Health Check)

`GET /api/health` (dipakai sebagai `healthcheckPath` Railway) mengembalikan status per komponen,
bukan hanya "hidup/mati" — tujuannya supaya saat deployment bermasalah, penyebabnya bisa langsung
dibedakan: **database** atau **aplikasi**. Contoh respons:

```json
{
  "status": "ok",
  "version": "4.2",
  "buildCommit": "a1b2c3d",
  "time": "2026-09-10T12:50:51.239Z",
  "failing": [],
  "checks": {
    "app": { "status": "ok" },
    "env": { "status": "ok" },
    "database": { "status": "ok", "latencyMs": 77 },
    "migrations": { "status": "ok" }
  }
}
```

Cara membaca hasilnya:

| Situasi | Penyebab | Yang harus dicek |
|---|---|---|
| `/api/health` tidak bisa diakses sama sekali (timeout/connection refused, bukan JSON) | Proses aplikasi **gagal start** — bukan masalah database | Log **build & deploy** Railway, bukan endpoint ini (build error, `start` command gagal, crash saat boot) |
| `checks.env.status: "error"` | Variabel environment wajib belum diatur (`DATABASE_URL`, `AUTH_SECRET`) | Tab *Variables* di service Railway |
| `checks.database.status: "error"` | Aplikasi jalan, tapi **tidak bisa konek ke database** | `DATABASE_URL`/`DIRECT_URL`, status plugin PostgreSQL, `checks.database.message` untuk pesan error asli |
| `checks.migrations.status: "error"` (padahal `database: "ok"`) | Database konek, tapi **skema/tabel belum ada** — kemungkinan `prisma migrate deploy` belum/gagal jalan | Log deploy (bagian `npx prisma migrate deploy`), coba jalankan ulang manual lewat *Shell* Railway |
| Semua `status: "ok"` tapi fitur tertentu tetap error | Di luar cakupan health check (mis. bug logika bisnis) | Log aplikasi (pino), halaman/endpoint terkait langsung |

`status: "error"` pada level teratas membuat healthcheck merespons HTTP 503, sehingga Railway akan
menandai deployment tidak sehat dan menjalankan `restartPolicy` sesuai `railway.json`.

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
  lib/                    # validasi Zod, aturan bisnis, Prisma client, offline (Dexie), version.ts, dll.
  components/              # komponen UI (form, dashboard, ui dasar bergaya shadcn/ui, app-footer.tsx)
public/
  manifest.json, sw.js, icons/   # aset PWA
railway.json               # konfigurasi build/start/healthcheck Railway
```

> Catatan: repo ini **tidak** memakai GitHub Actions/CI otomatis (lihat
> [Riwayat Revisi](#riwayat-revisi)) — jalankan pengecekan secara manual, lihat bagian
> [Testing](#testing) di bawah.

---

## Testing

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript strict
npm run test         # Vitest — unit test aturan bisnis (VL-01..VL-11)
npx prisma validate  # validasi skema Prisma
npm run build         # build produksi (memastikan semua route valid)
```

Unit test saat ini berfokus pada fungsi aturan bisnis murni di `src/lib/business-rules.ts`
(mudah diuji tanpa database). Endpoint API telah diverifikasi manual end-to-end
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
- **Audit trail** tersedia di skema (`audit_trail`) dan dicatat untuk aksi kelola interviewer,
  merek, serta edit/hapus warung & kunjungan oleh Master, namun belum ada halaman UI untuk
  menelusurinya (perlu query manual lewat Prisma Studio/database bila diperlukan).
- Ikon PWA (`public/icons/`) adalah placeholder sederhana — ganti dengan aset brand resmi bila
  tersedia sebelum dipublikasikan ke pengguna akhir.

Semua batasan di atas tidak mempengaruhi alur inti (login, input kunjungan, sinkronisasi
offline, dashboard, export) yang sudah diuji berjalan end-to-end.
