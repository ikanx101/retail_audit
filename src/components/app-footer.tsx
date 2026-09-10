import { APP_VERSION } from "@/lib/version";

export function AppFooter() {
  return (
    <footer className="py-4 text-center text-xs text-slate-400">
      Retail Audit Sachet — Versi {APP_VERSION}
    </footer>
  );
}
