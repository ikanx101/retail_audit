import { NextResponse } from "next/server";
import { auth } from "@/auth";

const MASTER_PREFIX = "/master";
const INTERVIEWER_PREFIX = "/interviewer";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/icons");

  if (isPublic) return NextResponse.next();

  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;

  if (pathname.startsWith(MASTER_PREFIX) && role !== "MASTER_RESEARCHER") {
    return NextResponse.redirect(new URL("/interviewer", req.nextUrl.origin));
  }

  if (pathname.startsWith(INTERVIEWER_PREFIX) && role !== "INTERVIEWER") {
    return NextResponse.redirect(new URL("/master", req.nextUrl.origin));
  }

  if (pathname.startsWith("/api/master") && role !== "MASTER_RESEARCHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (pathname === "/" ) {
    const dest = role === "MASTER_RESEARCHER" ? "/master" : "/interviewer";
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js).*)",
  ],
};
