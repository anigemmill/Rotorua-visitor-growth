import { ReportView } from "@/components/ReportView";
import { requireStaff } from "@/lib/auth/session";
import { founderReport } from "@/lib/reports/build";

export default async function Page() {
  const user = await requireStaff();
  return <ReportView report={await founderReport(user.role === "FOUNDER")} downloadHref="/api/reports?type=founder" />;
}
