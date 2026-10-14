import { AppShell, type NavGroup } from "@/components/AppShell";
import { requireStaff } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { ROLE_LABELS } from "@/lib/labels";

// Staff application. Operators are redirected to /portal by requireStaff();
// every page and action below re-checks authorisation itself as well.
export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const user = await requireStaff();

  const nav: NavGroup[] = [
    { items: [{ href: "/", label: "Dashboard" }] },
    {
      label: "Operators",
      items: [
        { href: "/operators", label: "Cohort & operators" },
        { href: "/assessments", label: "AI assessments" },
        { href: "/opportunities", label: "Opportunity register" },
        { href: "/work", label: "Projects & tasks" },
      ],
    },
    {
      label: "Programme",
      items: [
        { href: "/programme", label: "12-week programme" },
        { href: "/collective", label: "Growth Collective" },
        { href: "/experiments", label: "Experiments" },
        { href: "/results", label: "Baselines & results" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { href: "/reports", label: "Reports" },
        { href: "/library", label: "Agent & workflow library" },
        { href: "/destination", label: "Destination data", badge: "Next" },
      ],
    },
    ...(user.role === "FOUNDER" ? [{ label: "Business", items: [{ href: "/commercial", label: "Commercial" }] }] : []),
    {
      label: "Governance",
      items: [
        { href: "/governance", label: "Risks & decisions" },
        { href: "/governance/audit", label: "Audit log" },
        { href: "/export", label: "Data export" },
        ...(user.role === "FOUNDER" ? [{ href: "/settings/users", label: "Users & access" }] : []),
      ],
    },
  ];

  return (
    <AppShell nav={nav} user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }} logoutAction={logout} productLabel="Tourism AI Growth OS">
      {children}
    </AppShell>
  );
}
