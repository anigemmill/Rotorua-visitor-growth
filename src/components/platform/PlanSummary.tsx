// Renders a plan's entitlements in customer language. All values come from
// data (plan + licence overrides); nothing here knows about specific plans.

import { FEATURE_LABELS, SUPPORT_LABELS, type Entitlements, type FeatureKey } from "@/lib/platform/entitlements";

const n = (v: number | null | undefined, unit: string, plural = `${unit}s`) =>
  v === null ? `Custom ${plural}` : `${v ?? 0} ${v === 1 ? unit : plural}`;

function history(days: number | null | undefined) {
  if (days === null) return "Custom reporting history";
  if (!days) return "No reporting history";
  if (days % 365 === 0) return `${days / 365 === 1 ? "12 months" : `${days / 365} years`} of reporting history`;
  return `${days} days of reporting history`;
}

function workflows(v: number | null | undefined) {
  if (v === null) return "Custom workflows";
  if (!v) return "Standard workflows only";
  return `Up to ${v} custom workflow${v === 1 ? "" : "s"}`;
}

export function formatPrice(cents: number | null, currency: string): string {
  if (cents == null) return "Custom pricing";
  // en-US renders an unambiguous symbol for non-USD currencies (NZ$, A$).
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

export function PlanSummary({ e, showExcluded = false }: { e: Entitlements; showExcluded?: boolean }) {
  const cadences = e.reporting.cadences;
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1">
        <li>{n(e.limits.brands, "brand")}</li>
        <li>{n(e.limits.users, "user")}</li>
        <li>{n(e.limits.integrations, "connected integration")}</li>
        <li>
          {cadences.length === 3
            ? "Configurable scheduled reporting"
            : cadences.length
              ? `${cadences.map((c) => c[0].toUpperCase() + c.slice(1)).join(" or ")} scheduled reporting`
              : "No scheduled reporting"}
        </li>
        <li>{history(e.limits.historyDays)}</li>
        <li>{workflows(e.limits.customWorkflows)}</li>
        <li>{SUPPORT_LABELS[e.support.tier]}</li>
        <li>{e.ai ? "AI usage allowance included (monthly, not unlimited)" : "No AI usage allowance"}</li>
      </ul>
      <ul className="space-y-0.5 text-xs text-black/60 dark:text-white/60">
        {(Object.keys(FEATURE_LABELS) as FeatureKey[])
          .filter((k) => showExcluded || e.features[k])
          .map((k) => (
            <li key={k} className={e.features[k] ? "" : "text-black/35 line-through dark:text-white/35"}>
              {e.features[k] ? "✓ " : ""}
              {FEATURE_LABELS[k]}
            </li>
          ))}
      </ul>
    </div>
  );
}
