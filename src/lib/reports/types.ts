export interface Finding {
  title: string;
  whatChanged: string;
  evidence: string;
  whyItMatters: string;
  next: string;
  owner: string;
  reviewDate: string;
  illustrative?: boolean;
}

export interface ReportSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: (string | number)[][] };
  findings?: Finding[];
}

export interface Report {
  title: string;
  subtitle: string;
  generatedAt: Date;
  audience: string;
  notices: string[];
  sections: ReportSection[];
}

export function toMarkdown(r: Report): string {
  const out: string[] = [`# ${r.title}`, "", `_${r.subtitle}_`, "", `Generated ${r.generatedAt.toISOString().slice(0, 10)} · Audience: ${r.audience}`, ""];
  for (const n of r.notices) out.push(`> **Note:** ${n}`, "");
  for (const s of r.sections) {
    out.push(`## ${s.heading}`, "");
    for (const p of s.paragraphs ?? []) out.push(p, "");
    if (s.bullets?.length) out.push(...s.bullets.map((b) => `- ${b}`), "");
    if (s.table && s.table.rows.length) {
      const esc = (v: string | number) => String(v).replaceAll("|", "\\|").replaceAll("\n", " ");
      out.push(`| ${s.table.head.map(esc).join(" | ")} |`, `| ${s.table.head.map(() => "---").join(" | ")} |`);
      for (const row of s.table.rows) out.push(`| ${row.map(esc).join(" | ")} |`);
      out.push("");
    }
    for (const f of s.findings ?? []) {
      out.push(`### ${f.title}${f.illustrative ? " _(illustrative data)_" : ""}`, "");
      out.push(`- **What changed:** ${f.whatChanged}`, `- **Evidence:** ${f.evidence}`, `- **Why it matters:** ${f.whyItMatters}`, `- **What next:** ${f.next}`, `- **Owner:** ${f.owner}`, `- **Review:** ${f.reviewDate}`, "");
    }
  }
  return out.join("\n");
}
