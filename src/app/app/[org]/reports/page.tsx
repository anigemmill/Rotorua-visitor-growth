import { PageHeader, Panel } from "@/components/platform/ui";
import { requireOrg } from "@/lib/web/session";

const REPORTS = [
  { name: "Weekly Intelligence Brief", needs: "Website plus Google Analytics or Search Console" },
  { name: "Website & Search Report", needs: "Website and Search Console" },
  { name: "Campaign Performance Report", needs: "Google Ads or Meta Ads" },
  { name: "Commercial Performance Report", needs: "A booking system or booking export" },
];

export default async function ReportsPage({ params }: PageProps<"/app/[org]/reports">) {
  const { org } = await params;
  await requireOrg(org);
  return (
    <>
      <PageHeader
        title="Reports & actions"
        description="Reports and your action register will appear here once the ecosystem is activated. We never show sample or placeholder figures as if they were yours."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Panel key={r.name} title={r.name}>
            <p className="text-sm text-black/60 dark:text-white/60">No reports yet. Requires: {r.needs}.</p>
          </Panel>
        ))}
      </div>
      <Panel title="Action register" className="mt-6">
        <p className="text-sm text-black/60 dark:text-white/60">
          Each recommendation will be tracked through Proposed → Awaiting approval → Approved → In progress → Completed → Measured
          (or Rejected / Superseded), with your notes and measured outcomes. No actions yet.
        </p>
      </Panel>
    </>
  );
}
