import { Notice, PageHeader, Panel, Stat } from "@/components/platform/ui";
import { aiCostThisMonth, platformOverview } from "@/lib/platform/admin";
import { requireStaffUser } from "@/lib/web/session";

export default async function AdminHome() {
  await requireStaffUser();
  const [o, ai] = await Promise.all([platformOverview(), aiCostThisMonth()]);
  const usd = (micros: number) => `US$${(micros / 1_000_000).toFixed(2)}`;
  return (
    <>
      <PageHeader title="Platform overview" />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Organisations" value={o.organizations} />
        <Stat label="Users" value={o.users} />
        <Stat label="Connections in error" value={o.connectionsInError} />
        <Stat label="Failed logins (24h)" value={o.failedLoginsLast24h} />
      </div>
      <Panel title="AI model cost this month" className="mt-6" description={`Total ${usd(ai.totalMicrosUsd)} across ${ai.rows.length} customers (UTC month).`}>
        {ai.rows.length === 0 ? (
          <p className="text-sm text-black/60">No AI usage recorded yet.</p>
        ) : (
          <ul className="text-sm">
            {ai.rows.slice(0, 10).map((r) => (
              <li key={r.organizationId} className="flex justify-between py-0.5">
                <span>{r.name}</span>
                <span>
                  {usd(r.costMicrosUsd)} · {r.calls} calls
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Licences by status" className="mt-6">
        {Object.keys(o.licensesByStatus).length === 0 ? (
          <p className="text-sm text-black/60">No licences yet.</p>
        ) : (
          <ul className="text-sm">
            {Object.entries(o.licensesByStatus).map(([s, n]) => (
              <li key={s}>
                {s}: {n}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="mt-6">
        <Notice>
          Agent execution history, failed workflows, support issues and release notes are added with the
          orchestration layer (Phase 3) and production readiness work (Phase 6).
        </Notice>
      </div>
    </>
  );
}
