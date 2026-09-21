"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Role } from "@/generated/prisma";

const NAV = [
  { href: "/", label: "Executive Overview" },
  { href: "/visitors", label: "Visitor Demand, Spend & Stay" },
  { href: "/demand", label: "Search & AI Demand Signals" },
  { href: "/accommodation", label: "Accommodation" },
  { href: "/weather", label: "Weather" },
  { href: "/events", label: "Events" },
  { href: "/flow-capacity", label: "Visitor Flow & Capacity" },
  { href: "/opportunities", label: "Opportunities & Campaigns" },
  { href: "/ai-visibility", label: "AI Discovery" },
  { href: "/scenario", label: "Scenario Engine" },
  { href: "/data-governance", label: "Data Governance" },
];

export function DashboardShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: Role;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-black/10 dark:border-white/10 p-4 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold tracking-tight">Rotorua Visitor Intelligence</p>
          <p className="text-xs text-black/50 dark:text-white/50">Destination Command Centre</p>
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-black/10 dark:bg-white/10 font-medium"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-black/70 dark:text-white/70"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <RoleSwitcher role={role} />
        </div>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}

const ROLES: Role[] = ["PUBLIC", "BUSINESS", "PARTNER", "ADMIN"];

function RoleSwitcher({ role }: { role: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(role);

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-xs">
      <p className="text-black/50 dark:text-white/50 mb-1.5">
        Dev session role (no real auth yet — see docs/ARCHITECTURE.md §6)
      </p>
      <select
        className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent px-2 py-1 disabled:opacity-50"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Role;
          setCurrent(next);
          startTransition(async () => {
            await fetch("/api/dev-session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ role: next }),
            });
            router.refresh();
          });
        }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}
