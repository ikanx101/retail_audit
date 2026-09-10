import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

async function recordAuthLog(username: string, success: boolean, ip?: string | null, userAgent?: string | null) {
  try {
    await prisma.authLog.create({
      data: { username, success, ip: ip ?? undefined, userAgent: userAgent ?? undefined },
    });
  } catch (err) {
    logger.error({ err }, "gagal mencatat auth_log");
  }
}

/** FR-05: kunci sementara 15 menit setelah 5 kali gagal berturut-turut untuk akun yang sama. */
async function isAccountLocked(username: string): Promise<boolean> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await prisma.authLog.findMany({
    where: { username: { equals: username, mode: "insensitive" }, createdAt: { gte: fifteenMinAgo } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (recent.length < 5) return false;
  return recent.every((r) => !r.success);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // FR-04: sesi 30 hari
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const ip =
          request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const userAgent = request?.headers.get("user-agent") ?? null;

        if (await isAccountLocked(username)) {
          logger.warn({ username }, "login diblokir sementara (rate limit)");
          return null;
        }

        const user = await prisma.user.findFirst({
          where: { username: { equals: username, mode: "insensitive" } },
        });

        if (!user || !user.isActive) {
          await recordAuthLog(username, false, ip, userAgent);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordAuthLog(username, false, ip, userAgent);
          return null;
        }

        await recordAuthLog(username, true, ip, userAgent);
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.username = (user as { username: string }).username;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as "MASTER_RESEARCHER" | "INTERVIEWER";
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
