import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireRole } from "@/lib/api-auth";
import { brandSchema } from "@/lib/validations";
import { normalizeBrandName } from "@/lib/business-rules";

// Semua pengguna login (master & interviewer) boleh membaca suggestion list merek.
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const showAll = new URL(req.url).searchParams.get("all") === "1" && session!.user.role === "MASTER_RESEARCHER";

  const brands = await prisma.brand.findMany({
    where: showAll ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: brands });
}

// FR-11: Master mengelola master daftar merek.
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole("MASTER_RESEARCHER");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = brandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", issues: parsed.error.issues }, { status: 400 });
  }

  const { name, variant, category, isActive } = parsed.data;

  const normalized = normalizeBrandName(name);
  const existing = await prisma.brand.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Merek sudah ada" }, { status: 409 });
  }

  const brand = await prisma.brand.create({
    data: { name: name.trim(), variant: variant || null, category: category || null, isActive, createdById: session!.user.id },
  });

  return NextResponse.json({ data: brand }, { status: 201 });
}
