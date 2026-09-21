import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// GET /api/master/visits/[id]/photos/[photoId] — Master melihat (inline) atau mengunduh
// (?download=1) satu foto lampiran kunjungan (v4.2).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const { id, photoId } = await params;
  const download = new URL(req.url).searchParams.get("download") === "1";

  const photo = await prisma.visitPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.visitId !== id) {
    return NextResponse.json({ error: "Foto tidak ditemukan" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.sizeBytes),
      // "no-store" (bukan cache lama, mis. immutable) — endpoint ini dijaga otorisasi per
      // request; men-cache-nya di browser berisiko foto masih terbaca setelah Master logout
      // di perangkat yang dipakai bersama (mis. tablet lapangan gantian dengan interviewer).
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="${photo.fileName}"` } : {}),
    },
  });
}
