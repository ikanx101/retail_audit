"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/master", label: "Ringkasan" },
  { href: "/master/warungs", label: "Warung" },
  { href: "/master/kunjungan", label: "Kunjungan" },
  { href: "/master/interviewer", label: "Interviewer" },
  { href: "/master/merek", label: "Merek" },
  { href: "/master/kualitas-data", label: "Kualitas Data" },
  { href: "/master/export", label: "Export" },
];

export function MasterNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
              active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
