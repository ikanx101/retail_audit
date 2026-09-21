"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { compressImageFile } from "@/lib/image-compress";
import { MAX_PHOTOS_PER_SUBMISSION, MAX_PHOTO_BYTES } from "@/lib/validations";
import { base64ByteLength } from "@/lib/utils";

export interface PhotoState {
  key: string;
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  dataBase64: string;
}

// Lampiran foto (v4.2) di Formulir Cuaca & Formulir Merek/Penjualan. Bersifat TAMBAHAN saat
// disimpan ke server (append-only, lihat outlet-service.ts) — komponen ini hanya mengelola foto
// baru yang akan disertakan pada submit kali ini, bukan riwayat foto yang sudah tersimpan.
export function PhotoUploadField({
  value,
  onChange,
  onError,
  maxPhotos = MAX_PHOTOS_PER_SUBMISSION,
}: {
  value: PhotoState[];
  onChange: (photos: PhotoState[]) => void;
  onError?: (message: string) => void;
  maxPhotos?: number;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = React.useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const accepted: PhotoState[] = [];

    setProcessing(true);
    try {
      for (const file of incoming) {
        if (value.length + accepted.length >= maxPhotos) {
          onError?.(`Maksimal ${maxPhotos} foto per formulir`);
          break;
        }
        if (file.type !== "image/png" && file.type !== "image/jpeg") {
          onError?.(`${file.name}: hanya file PNG atau JPEG yang didukung`);
          continue;
        }
        try {
          const compressed = await compressImageFile(file);
          if (base64ByteLength(compressed.dataBase64) > MAX_PHOTO_BYTES) {
            onError?.(`${file.name}: ukuran foto masih terlalu besar setelah dikompres`);
            continue;
          }
          accepted.push({ key: crypto.randomUUID(), ...compressed });
        } catch {
          onError?.(`${file.name}: gagal memproses foto`);
        }
      }
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }

    if (accepted.length > 0) onChange([...value, ...accepted]);
  }

  function removePhoto(key: string) {
    onChange(value.filter((p) => p.key !== key));
  }

  return (
    <div className="space-y-3">
      <Label>Foto (opsional — PNG/JPEG, maks {maxPhotos})</Label>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((p) => (
            <div key={p.key} className="relative overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${p.mimeType};base64,${p.dataBase64}`}
                alt={p.fileName}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(p.key)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                aria-label={`Hapus foto ${p.fileName}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < maxPhotos && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="photo-upload-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
          >
            {processing ? "Memproses..." : "+ Tambah Foto"}
          </Button>
        </div>
      )}
    </div>
  );
}
