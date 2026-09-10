"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buttonClassNames } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WarungBaruSuksesPage() {
  return (
    <React.Suspense fallback={null}>
      <SuksesContent />
    </React.Suspense>
  );
}

function SuksesContent() {
  const searchParams = useSearchParams();
  const nama = searchParams.get("nama") ?? "Warung";

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="text-lg font-semibold text-slate-900">Kunjungan Tersimpan</h1>
      <Card className="w-full">
        <CardContent className="p-4 text-sm text-slate-600">
          Data <span className="font-medium text-slate-900">{nama}</span> beserta hasil audit kunjungan pertama
          berhasil disimpan.
        </CardContent>
      </Card>
      <div className="flex w-full flex-col gap-2">
        <Link href="/interviewer/warung/baru" className={buttonClassNames({ size: "lg", className: "w-full" })}>
          Lanjut Input Warung Baru
        </Link>
        <Link
          href="/interviewer"
          className={buttonClassNames({ variant: "outline", size: "lg", className: "w-full" })}
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
