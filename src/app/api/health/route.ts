import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BUILD_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.npm_package_version ?? "dev";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected", version: BUILD_VERSION, time: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: "error", db: "disconnected", version: BUILD_VERSION, time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
