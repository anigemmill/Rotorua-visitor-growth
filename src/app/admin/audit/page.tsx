import { PageHeader, formatDate } from "@/components/platform/ui";
import { listAuditEvents } from "@/lib/platform/admin";
import { requireStaffUser } from "@/lib/web/session";

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireStaffUser();
  const { action } = await props.searchParams;
  const events = await listAuditEvents({ action: typeof action === "string" ? action : undefined, take: 300 });
  return (
    <>
      <PageHeader title="Audit log" description="Security, licensing and configuration events. Filter with ?action=auth. or ?action=license." />
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/[0.03] uppercase text-black/50 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Organisation</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-3 py-1.5">{formatDate(e.createdAt, true)}</td>
                <td className="px-3 py-1.5 font-mono">{e.action}</td>
                <td className="px-3 py-1.5">{e.actorEmail ?? "—"}</td>
                <td className="px-3 py-1.5">{e.organization?.name ?? "—"}</td>
                <td className="px-3 py-1.5">{e.targetType ? `${e.targetType}:${e.targetId}` : "—"}</td>
                <td className="px-3 py-1.5">{e.ipAddress ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono">{e.metadata ? JSON.stringify(e.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
