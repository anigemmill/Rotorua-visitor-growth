"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-teal-700/10 font-medium text-teal-900 dark:text-teal-200"
          : "text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  );
}
