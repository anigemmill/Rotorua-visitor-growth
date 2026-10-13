import Link from "next/link";
import { PageHeader, Pill, formatDate } from "@/components/platform/ui";
import { listOrganizations } from "@/lib/platform/admin";
import { STAGE_LABELS } from "@/lib/platform/onboarding";
import { requireStaffUser } from "@/lib/web/session";

export default async function OrganizationsPage() {
  await requireStaffUser();
  const orgs = await listOrganizations();
  return (
    <>
      <PageHeader title="Customers" description="Every organisation, its licence and onboarding status." />
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-black/50 dark:bg-white/5 dark:text-white/50">
            <tr>
              <th className="px-4 py-2">Organisation</th>
              <th className="px-4 py-2">Licence</th>
              <th className="px-4 py-2">Onboarding</th>
              <th className="px-4 py-2">Members</th>
              <th className="px-4 py-2">Connections</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {orgs.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2">
                  <Link href={`/admin/organizations/${o.id}`} className="font-medium underline">
                    {o.name}
                  </Link>
                  {o.status !== "ACTIVE" && (
                    <span className="ml-2">
                      <Pill tone="bad">{o.status}</Pill>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {o.licenses.length === 0 ? (
                    <Pill>None</Pill>
                  ) : (
                    o.licenses.map((l) => (
                      <Pill key={l.id} tone={l.access.mode === "full" ? "good" : l.access.mode === "none" ? "bad" : "warn"}>
                        {l.plan.name} · {l.status}
                      </Pill>
                    ))
                  )}
                </td>
                <td className="px-4 py-2">{STAGE_LABELS[o.onboardingStage]}</td>
                <td className="px-4 py-2">{o._count.memberships}</td>
                <td className="px-4 py-2">{o._count.integrations}</td>
                <td className="px-4 py-2">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && <p className="p-4 text-sm text-black/60">No organisations yet.</p>}
      </div>
    </>
  );
}
