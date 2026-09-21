// Small shared presentational primitives for the Command Centre. Kept in
// one file deliberately — there are only a handful of shapes repeated
// across every dashboard section, not enough to warrant a component
// library at MVP.

import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-black/60 dark:text-white/60">{description}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  needs,
}: {
  title: string;
  needs: string[];
}) {
  return (
    <Card className="border-dashed">
      <p className="font-medium text-sm">{title}</p>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">Awaiting data. This section needs:</p>
      <ul className="mt-2 list-disc list-inside text-sm text-black/70 dark:text-white/70 space-y-0.5">
        {needs.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </Card>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-black/50 dark:text-white/50">{sub}</p>}
    </Card>
  );
}

const ACCESS_LEVEL_STYLES: Record<string, string> = {
  PUBLIC: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  PARTNER: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  PRIVATE_BUSINESS: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  AGGREGATED: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  MODEL_INFERENCE: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
};

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: string }) {
  const style = ACCESS_LEVEL_STYLES[tone] ?? "bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/70";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {children}
    </span>
  );
}
