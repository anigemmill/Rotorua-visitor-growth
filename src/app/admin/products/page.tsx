import { PageHeader, Panel, Pill } from "@/components/platform/ui";
import { listPlans } from "@/lib/platform/admin";
import { mergeEntitlements } from "@/lib/platform/entitlements";
import { requireStaffUser } from "@/lib/web/session";

export default async function ProductsPage() {
  await requireStaffUser();
  const products = await listPlans();
  return (
    <>
      <PageHeader
        title="Products & plans"
        description="Commercial rules are data. Plans and entitlements are managed via prisma/seed.ts for now; an editor is on the backlog."
      />
      {products.map((p) => (
        <Panel key={p.id} title={p.name} description={`${p.key} · ${p.active ? "active" : "inactive"}`} className="mb-6">
          <p className="text-sm font-medium">Versions</p>
          <ul className="mb-4 text-sm">
            {p.versions.map((v) => (
              <li key={v.id}>
                v{v.version} {v.isCurrent && <Pill tone="good">current</Pill>} — {v.releaseNotes}
              </li>
            ))}
          </ul>
          <div className="grid gap-4 md:grid-cols-3">
            {p.plans.map((pl) => (
              <div key={pl.id} className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
                <p className="font-medium">
                  {pl.name} <span className="font-mono text-xs text-black/50">{pl.key}</span>
                </p>
                <p className="text-xs text-black/60">
                  {pl.billingInterval} · {pl.priceCents == null ? "price on request" : `${pl.priceCents / 100} ${pl.currency}`} ·{" "}
                  {pl.isPublic ? "public" : "private"} · {pl.selfServeTrial ? `${pl.trialDays}-day self-serve trial` : "staff-provisioned"}
                </p>
                <pre className="mt-2 overflow-x-auto rounded bg-black/[0.03] p-2 text-xs dark:bg-white/5">
                  {JSON.stringify(mergeEntitlements(pl.entitlements, null), null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </>
  );
}
