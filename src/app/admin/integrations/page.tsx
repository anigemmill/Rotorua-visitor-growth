import Link from "next/link";
import { PageHeader, Pill, formatDate } from "@/components/platform/ui";
import { integrationHealth } from "@/lib/platform/admin";
import { requireStaffUser } from "@/lib/web/session";

export default async function IntegrationHealthPage() {
  await requireStaffUser();
  const rows = await integrationHealth();
  return (
    <>
      <PageHeader title="Integration health" description="All active connections across customers. Credentials are never shown." />
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.03] text-xs uppercase text-black/50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last success</th>
              <th className="px-4 py-2">Last error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  <Link href={`/admin/organizations/${r.organization.id}`} className="underline">
                    {r.organization.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.providerKey}</td>
                <td className="px-4 py-2">{r.externalAccountId}</td>
                <td className="px-4 py-2">
                  <Pill tone={r.status === "ERROR" ? "bad" : r.status === "CONNECTED" ? "good" : "info"}>{r.status}</Pill>
                </td>
                <td className="px-4 py-2">{formatDate(r.lastSuccessfulSyncAt, true)}</td>
                <td className="px-4 py-2 text-red-600">{r.lastErrorMessage ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-black/60">No connections yet.</p>}
      </div>
    </>
  );
}
