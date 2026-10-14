import Link from "next/link";
import { LogoutButton } from "@/components/platform/LogoutButton";
import { NavLink } from "@/components/platform/NavLink";
import { Notice } from "@/components/platform/ui";
import { getLicenseState } from "@/lib/platform/licensing";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/platform/permissions";
import { getAiUsageStatus } from "@/lib/platform/usage";
import { requireOrg } from "@/lib/web/session";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/app/[org]">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const license = await getLicenseState(ctx.db);
  const usage = license.license ? await getAiUsageStatus(ctx.db, license.entitlements) : null;
  const base = `/app/${ctx.organization.slug}`;

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-neutral-950">
      <aside className="flex w-64 shrink-0 flex-col gap-6 border-r border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
        <div>
          <Link href="/workspaces" className="text-xs text-black/50 hover:underline dark:text-white/50">
            ← All workspaces
          </Link>
          <p className="mt-2 font-semibold tracking-tight">{ctx.organization.name}</p>
          <p className="text-xs text-black/50 dark:text-white/50">
            Tourism Intelligence · {MEMBERSHIP_ROLE_LABELS[ctx.role]}
          </p>
        </div>
        <nav className="space-y-4">
          <div className="space-y-0.5">
            <NavLink href={base} exact>
              Overview
            </NavLink>
            <NavLink href={`${base}/ecosystem`}>Agent ecosystem</NavLink>
            <NavLink href={`${base}/reports`}>Reports & actions</NavLink>
          </div>
          <div>
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">Setup</p>
            <div className="space-y-0.5">
              <NavLink href={`${base}/onboarding/profile`}>1. Business profile</NavLink>
              <NavLink href={`${base}/onboarding/knowledge`}>2. Business knowledge</NavLink>
              <NavLink href={`${base}/integrations`}>3. Connections</NavLink>
              <NavLink href={`${base}/onboarding/validation`}>4. Validation</NavLink>
              <NavLink href={`${base}/onboarding/activation`}>5. Activation</NavLink>
              <NavLink href={`${base}/brands`}>Brands</NavLink>
            </div>
          </div>
          <div>
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">Account</p>
            <div className="space-y-0.5">
              <NavLink href={`${base}/settings/licence`}>Licence & plan</NavLink>
              <NavLink href={`${base}/settings/team`}>Team</NavLink>
              <NavLink href={`${base}/settings/data`}>Data & privacy</NavLink>
            </div>
          </div>
        </nav>
        <div className="mt-auto space-y-1 text-xs text-black/50 dark:text-white/50">
          <p className="truncate">{ctx.user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-5xl">
          {license.access.mode !== "full" && (
            <div className="mb-6">
              <Notice tone="warn">
                {license.license ? license.access.reason : "No licence yet."}{" "}
                {license.access.mode === "read_only"
                  ? "You can view and export your data, but new connections and agent runs are paused."
                  : "Start a pilot or contact us to activate the ecosystem."}{" "}
                <Link href={`${base}/settings/licence`} className="font-medium underline">
                  Licence & plan
                </Link>
              </Notice>
            </div>
          )}
          {license.access.inGracePeriod && (
            <div className="mb-6">
              <Notice tone="warn">{license.access.reason} Access continues during a short grace period.</Notice>
            </div>
          )}
          {(usage?.state === "warning" || usage?.state === "limit_reached") && (
            <div className="mb-6">
              <Notice tone={usage.state === "limit_reached" ? "bad" : "warn"}>
                {usage.state === "limit_reached"
                  ? "Your AI usage allowance for this month is used up. Analysis is paused until it resets."
                  : `You've used over ${usage.warnAtPercent}% of this month's AI usage allowance.`}{" "}
                <Link href={`${base}/settings/licence`} className="font-medium underline">
                  Details
                </Link>
              </Notice>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
