import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "OPERATOR" || !user.operatorId) redirect("/");
  const op = await prisma.operator.findUnique({ where: { id: user.operatorId }, select: { name: true } });
  return (
    <AppShell
      productLabel="Growth Pilot Portal"
      user={{ name: user.name, roleLabel: "Operator", context: op?.name }}
      logoutAction={logout}
      nav={[{ items: [{ href: "/portal", label: "My business" }, { href: "/portal/collective", label: "Growth Collective" }] }]}
    >
      {children}
    </AppShell>
  );
}
