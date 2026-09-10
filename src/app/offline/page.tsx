export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-4xl">📴</div>
      <h1 className="text-lg font-semibold">Anda sedang offline</h1>
      <p className="max-w-sm text-sm text-slate-600">
        Halaman ini belum pernah dibuka sebelumnya sehingga tidak tersedia secara offline. Form yang
        pernah dibuka tetap dapat diisi dan akan tersinkron otomatis saat koneksi kembali.
      </p>
    </main>
  );
}
