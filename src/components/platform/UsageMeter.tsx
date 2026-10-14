// AI usage against the monthly allowance. Customers see a percentage, never
// raw provider costs.

import type { AiUsageStatus } from "@/lib/platform/usage";
import { formatDate } from "./ui";

export function UsageMeter({ status }: { status: AiUsageStatus }) {
  if (status.state === "no_allowance") {
    return <p className="text-sm text-black/60 dark:text-white/60">This plan does not include AI analysis.</p>;
  }
  const pct = Math.min(100, Math.round(status.percentUsed));
  const bar =
    status.state === "limit_reached" ? "bg-red-600" : status.state === "warning" ? "bg-amber-500" : "bg-teal-700";
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span>AI usage this month</span>
        <span className="font-medium">{Math.round(status.percentUsed)}% of allowance</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="AI usage allowance used"
      >
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-black/55 dark:text-white/55">
        {status.state === "limit_reached"
          ? "The allowance is used up. Scheduled analysis is paused until it resets"
          : status.state === "warning"
            ? `Over ${status.warnAtPercent}% used. Analysis continues until the limit, then pauses until it resets`
            : "Resets"}{" "}
        on {formatDate(status.periodEnd)}.
      </p>
    </div>
  );
}
