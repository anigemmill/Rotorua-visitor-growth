import { ReportView } from "@/components/ReportView";
import { requireFounder } from "@/lib/auth/session";
import { commercialReport } from "@/lib/reports/build";

export default async function Page() {
  await requireFounder();
  return <ReportView report={await commercialReport()} downloadHref="/api/reports?type=commercial" />;
}
