import Link from "next/link";
import { LogoutButton } from "@/components/platform/LogoutButton";
import { NavLink } from "@/components/platform/NavLink";
import { requireStaffUser } from "@/lib/web/session";

export const metadata = { title: "Platform admin", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaffUser();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-black/10 bg-neutral-900 p-4 text-white">
        <div>
          <p className="font-semibold">Platform admin</p>
          <p className="text-xs text-white/50">{staff.user.platformRole === "SUPER_ADMIN" ? "Super-admin" : "Support (read-only)"}</p>
        </div>
        <nav className="space-y-0.5 [&_a]:text-white/80 [&_a[aria-current]]:bg-white/10 [&_a[aria-current]]:text-white">
          <NavLink href="/admin" exact>
            Overview
          </NavLink>
          <NavLink href="/admin/organizations">Customers</NavLink>
          <NavLink href="/admin/products">Products & plans</NavLink>
          <NavLink href="/admin/integrations">Integration health</NavLink>
          <NavLink href="/admin/audit">Audit log</NavLink>
          <NavLink href="/destination">Destination dashboard (Rotorua)</NavLink>
        </nav>
        <div className="mt-auto space-y-1 text-xs text-white/60">
          <p className="truncate">{staff.user.email}</p>
          <Link href="/workspaces" className="block underline">
            My workspaces
          </Link>
          <div className="[&_button]:text-white/60">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
