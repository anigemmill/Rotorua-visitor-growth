"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

export interface NavGroup {
  label?: string;
  items: { href: string; label: string; badge?: string }[];
}

export function AppShell({
  nav,
  user,
  logoutAction,
  children,
  productLabel,
}: {
  nav: NavGroup[];
  user: { name: string; roleLabel: string; context?: string };
  logoutAction: () => Promise<void>;
  children: ReactNode;
  productLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/" || href === "/portal" ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">Outside In</p>
        <p className="mt-0.5 text-sm font-semibold tracking-tight text-ink">{productLabel}</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {nav.map((g, i) => (
          <div key={i} className="mb-4">
            {g.label && <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">{g.label}</p>}
            <ul className="space-y-px">
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
                      )}
                    >
                      <span>{item.label}</span>
                      {item.badge && <span className="text-[10px] uppercase tracking-wide text-subtle">{item.badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-5 py-4">
        <p className="truncate text-sm font-medium text-ink">{user.name}</p>
        <p className="truncate text-xs text-subtle">
          {user.roleLabel}
          {user.context ? ` · ${user.context}` : ""}
        </p>
        <form action={logoutAction} className="mt-2">
          <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden no-print">
        <p className="text-sm font-semibold">{productLabel}</p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="rounded-md border border-line-strong px-2.5 py-1 text-sm"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-0 top-[53px] z-20 bg-surface lg:hidden">
          {sidebar}
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-surface lg:block no-print">{sidebar}</aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
