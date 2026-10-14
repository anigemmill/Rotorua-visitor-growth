import { Badge, ButtonLink, Card, Notice, PageHeader, Table } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import type { Report } from "@/lib/reports/types";
import { formatDate } from "@/lib/format";

export function ReportView({ report, downloadHref }: { report: Report; downloadHref: string }) {
  return (
    <div>
      <PageHeader
        eyebrow="Report"
        title={report.title}
        description={`${report.subtitle} · Generated ${formatDate(report.generatedAt)} · Audience: ${report.audience}`}
        actions={<><PrintButton /><ButtonLink href={downloadHref}>Download Markdown</ButtonLink></>}
      />
      <div className="space-y-6">
        {report.notices.map((n) => <Notice key={n} tone="warning">{n}</Notice>)}
        {report.sections.map((s) => (
          <Card key={s.heading} title={s.heading} padded={!s.table || !!s.paragraphs || !!s.findings}>
            {s.paragraphs?.map((p, i) => <p key={i} className="mb-2 text-sm leading-relaxed last:mb-0">{p}</p>)}
            {s.bullets && s.bullets.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{s.bullets.map((b, i) => <li key={i}>{b.replaceAll("**", "").replaceAll("_", "")}</li>)}</ul>}
            {s.bullets && s.bullets.length === 0 && <p className="text-sm text-muted">None.</p>}
            {s.table && (s.table.rows.length ? (
              <Table><thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></Table>
            ) : <p className="px-5 py-4 text-sm text-muted">No data.</p>)}
            {s.findings && (
              <div className="space-y-4">
                {s.findings.map((f, i) => (
                  <div key={i} className="rounded-lg border border-line p-4">
                    <p className="font-semibold">{f.title} {f.illustrative && <Badge tone="warning">Illustrative</Badge>}</p>
                    <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {([["What changed", f.whatChanged], ["Evidence", f.evidence], ["Why it matters", f.whyItMatters], ["What next", f.next], ["Owner", f.owner], ["Review", f.reviewDate]] as const).map(([k, v]) => (
                        <div key={k}><dt className="text-xs font-medium text-muted">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
