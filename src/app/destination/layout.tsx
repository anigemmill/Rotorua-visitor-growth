import { DashboardShell } from "@/components/DashboardShell";
import { requireStaffUser } from "@/lib/web/session";

// The original Rotorua Destination Command Centre. It has no tenant model of
// its own, so it is restricted to platform staff until it is folded into the
// licensed product as a destination-level ecosystem (see roadmap).
export default async function DestinationLayout({ children }: LayoutProps<"/destination">) {
  const staff = await requireStaffUser();
  return <DashboardShell staffEmail={staff.user.email}>{children}</DashboardShell>;
}
