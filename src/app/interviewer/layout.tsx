import { auth } from "@/auth";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";

export default async function InterviewerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/interviewer" className="font-semibold text-slate-900">
            Retail Audit
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{session?.user?.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-4 py-4">{children}</div>
    </div>
  );
}
