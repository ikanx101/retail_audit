import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Belum login" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireRole(role: "MASTER_RESEARCHER" | "INTERVIEWER") {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user.role !== role) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}
