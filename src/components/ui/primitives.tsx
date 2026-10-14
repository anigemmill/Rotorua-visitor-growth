// Outside In design system — layout & display primitives (server-safe).

import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-subtle">{eyebrow}</div>}
        <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 no-print">{actions}</div>}
    </header>
  );
}

/** Back-compat alias used by the destination-intelligence pages. */
export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <PageHeader title={title} description={description} eyebrow="Destination intelligence" />;
}

export function Card({
  children,
  className = "",
  title,
  description,
  actions,
  padded = true,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02)]", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2 no-print">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const valueTone =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink";
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", valueTone)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-subtle">{sub}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface p-4";
  return href ? (
    <Link href={href} className={cx(cls, "transition-colors hover:border-line-strong")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Back-compat alias. */
export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <Stat label={label} value={value} sub={sub} />;
}

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-1 ring-inset ring-line",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  outline: "text-muted ring-1 ring-inset ring-line-strong",
};

// Legacy access-level tones used by destination pages.
const LEGACY: Record<string, Tone> = {
  PUBLIC: "success", PARTNER: "info", PRIVATE_BUSINESS: "warning", AGGREGATED: "accent", MODEL_INFERENCE: "neutral",
};

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone | string; title?: string }) {
  const t = (TONES as Record<string, string>)[tone] ? (tone as Tone) : LEGACY[tone] ?? "neutral";
  return (
    <span
      title={title}
      className={cx("inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4", TONES[t])}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  needs,
  children,
  action,
}: {
  title: string;
  needs?: string[];
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface-2 px-5 py-6 text-sm">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
      {needs && needs.length > 0 && (
        <>
          <p className="mt-1 text-muted">This section needs:</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted">
            {needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("-mx-px overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted">
        {children}
      </table>
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

export function buttonClass(variant: "primary" | "secondary" | "ghost" | "danger" = "secondary", size: "sm" | "md" = "md") {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sz = size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm";
  const v = {
    primary: "bg-accent text-accent-ink hover:opacity-90",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
    ghost: "text-muted hover:bg-surface-2 hover:text-ink",
    danger: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
  }[variant];
  return cx(base, sz, v);
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{it.label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap break-words text-ink">
            {it.value === null || it.value === undefined || it.value === "" ? <span className="text-subtle">—</span> : it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, current }: { tabs: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line no-print" aria-label="Sections">
      {tabs.map((t) => {
        const active = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-xs text-subtle">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const cls = {
    info: "border-info/25 bg-info-soft text-info",
    warning: "border-warning/25 bg-warning-soft text-warning",
    danger: "border-danger/25 bg-danger-soft text-danger",
    success: "border-success/25 bg-success-soft text-success",
  }[tone];
  return <div className={cx("rounded-lg border px-3.5 py-2.5 text-sm", cls)}>{children}</div>;
}

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export function TextBlock({ children }: { children?: string | null }) {
  if (!children) return <span className="text-subtle">—</span>;
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{children}</p>;
}
