import { Notice, PageHeader, Panel, Stat } from "@/components/platform/ui";
import { platformOverview } from "@/lib/platform/admin";
import { requireStaffUser } from "@/lib/web/session";

export default async function AdminHome() {
  await requireStaffUser();
  const o = await platformOverview();
  return (
    <>
      <PageHeader title="Platform overview" />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Organisations" value={o.organizations} />
        <Stat label="Users" value={o.users} />
        <Stat label="Connections in error" value={o.connectionsInError} />
        <Stat label="Failed logins (24h)" value={o.failedLoginsLast24h} />
      </div>
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
          Agent execution history, failed workflows, usage and cost, support issues and release notes are added with the
          orchestration layer (Phase 3) and production readiness work (Phase 6).
        </Notice>
      </div>
    </>
  );
}
