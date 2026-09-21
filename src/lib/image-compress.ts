// Sejak v4.2: kompres & downscale foto lampiran di browser sebelum dikirim — menghemat kuota
// data interviewer di lapangan dan ukuran penyimpanan di server (foto disimpan sebagai bytea,
// lihat model VisitPhoto).
export const PHOTO_MAX_DIMENSION = 1600;
export const PHOTO_JPEG_QUALITY = 0.8;

export interface CompressedPhoto {
  fileName: string;
  mimeType: "image/png" | "image/jpeg";
  dataBase64: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar"));
    };
    img.src = url;
  });
}

export async function compressImageFile(file: File): Promise<CompressedPhoto> {
  const mimeType: "image/png" | "image/jpeg" = file.type === "image/png" ? "image/png" : "image/jpeg";
  const img = await loadImage(file);

  let { width, height } = img;
  if (width > PHOTO_MAX_DIMENSION || height > PHOTO_MAX_DIMENSION) {
    const scale = PHOTO_MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kanvas tidak didukung di perangkat ini");
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl =
    mimeType === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  const dataBase64 = dataUrl.split(",")[1] ?? "";

  return { fileName: file.name, mimeType, dataBase64 };
}
