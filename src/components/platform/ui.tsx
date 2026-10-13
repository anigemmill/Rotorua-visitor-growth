// Presentational primitives for the customer and admin apps.

import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1.5 text-sm text-black/60 dark:text-white/60">{description}</div>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, description, children, className = "" }: { title?: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 ${className}`}>
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {description && <div className="mt-1 text-sm text-black/60 dark:text-white/60">{description}</div>}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-black/5 text-black/70 dark:bg-white/10 dark:text-white/70",
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-800 dark:text-amber-400",
  bad: "bg-red-500/10 text-red-700 dark:text-red-400",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: Tone }) {
  return <div className={`rounded-lg px-4 py-3 text-sm ${TONES[tone]}`}>{children}</div>;
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-teal-700 text-white hover:bg-teal-800"
      : "border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10";
  return (
    <Link href={href} className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${styles}`}>
      {children}
    </Link>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">{sub}</p>}
    </div>
  );
}

export function List({ items, empty = "—" }: { items: string[]; empty?: string }) {
  if (items.length === 0) return <span className="text-black/40 dark:text-white/40">{empty}</span>;
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export function formatDate(d: Date | null | undefined, withTime = false): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Pacific/Auckland",
  }).format(d);
}
