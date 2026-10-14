import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { caseStudyDraft, cohortReport, commercialReport, experimentReport, founderReport, operatorReport } from "@/lib/reports/build";
import { toMarkdown, type Report } from "@/lib/reports/types";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return NextResponse.json({ error: "Programme staff only." }, { status: 403 });
  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let report: Report | null = null;
  switch (type) {
    case "operator": report = await operatorReport(id); break;
    case "experiment": report = await experimentReport(id); break;
    case "cohort": report = await cohortReport(); break;
    case "founder": report = await founderReport(user.role === "FOUNDER"); break;
    case "case-study": report = (await caseStudyDraft(id)).report; break;
    case "commercial":
      if (user.role !== "FOUNDER") return NextResponse.json({ error: "Founder only." }, { status: 403 });
      report = await commercialReport();
      break;
    default:
      return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
  }
  if (!report) return NextResponse.json({ error: "Not found or not permitted." }, { status: 404 });
  await audit(user.id, "export", "report", id || type, `Downloaded ${type} report`);
  const name = `${type}-${new Date().toISOString().slice(0, 10)}.md`;
  return new NextResponse(toMarkdown(report), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
