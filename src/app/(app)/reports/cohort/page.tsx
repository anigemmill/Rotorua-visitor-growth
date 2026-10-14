import { ReportView } from "@/components/ReportView";
import { requireStaff } from "@/lib/auth/session";
import { cohortReport } from "@/lib/reports/build";

export default async function Page() {
  await requireStaff();
  return <ReportView report={await cohortReport()} downloadHref="/api/reports?type=cohort" />;
}
