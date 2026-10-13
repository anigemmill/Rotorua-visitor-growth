"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/destination", label: "Executive Overview" },
  { href: "/destination/visitors", label: "Visitor Demand, Spend & Stay" },
  { href: "/destination/demand", label: "Search & AI Demand Signals" },
  { href: "/destination/accommodation", label: "Accommodation" },
  { href: "/destination/weather", label: "Weather" },
  { href: "/destination/events", label: "Events" },
  { href: "/destination/flow-capacity", label: "Visitor Flow & Capacity" },
  { href: "/destination/opportunities", label: "Opportunities & Campaigns" },
  { href: "/destination/ai-visibility", label: "AI Discovery" },
  { href: "/destination/scenario", label: "Scenario Engine" },
  { href: "/destination/data-governance", label: "Data Governance" },
];

export function DashboardShell({ children, staffEmail }: { children: React.ReactNode; staffEmail: string | null }) {
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
        <div className="mt-auto rounded-lg border border-black/10 dark:border-white/10 p-3 text-xs text-black/60 dark:text-white/60">
          <p>Platform staff tool</p>
          {staffEmail && <p className="mt-0.5 truncate">{staffEmail}</p>}
          <Link href="/admin" className="mt-1.5 inline-block underline">
            Back to admin
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
