import { ActionForm, Badge, Card, FormGrid, Notice, PageHeader, Select, Table, TextField } from "@/components/ui";
import { requireFounder } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { operatorOptions } from "@/lib/queries";
import { ROLE_LABELS, options } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { createUser, resetPassword, setUserActive } from "./actions";

export default async function UsersPage() {
  const me = await requireFounder();
  const [users, operatorOpts] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], include: { operator: { select: { name: true } } } }),
    operatorOptions(),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Users & access" description="Founder: everything incl. commercial. Programme admin: all delivery data, no commercial or user management. Operator: their own business plus cohort-shared content only." />
      <div className="mb-6"><Notice tone="info">No email is sent by this application. Share initial passwords through a secure channel. Single sign-on and self-service password reset are on the backlog.</Notice></div>
      <Card padded={false} className="mb-6">
        <Table>
          <thead><tr><th>User</th><th>Role</th><th>Business</th><th>Last login</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><p className="font-medium">{u.name}</p><p className="text-xs text-muted">{u.email}</p></td>
                <td><Badge tone={u.role === "FOUNDER" ? "accent" : u.role === "ADMIN" ? "info" : "neutral"}>{ROLE_LABELS[u.role]}</Badge></td>
                <td className="text-muted">{u.operator?.name ?? "—"}</td>
                <td className="text-xs text-muted">{formatDate(u.lastLoginAt)}</td>
                <td>{u.active ? <Badge tone="success">Active</Badge> : <Badge tone="outline">Deactivated</Badge>}</td>
                <td className="min-w-[14rem]">
                  {u.id !== me.id && (
                    <div className="space-y-2">
                      <ActionForm action={setUserActive.bind(null, u.id)} inline submitLabel={u.active ? "Deactivate" : "Reactivate"} variant={u.active ? "danger" : "secondary"}>
                        <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                      </ActionForm>
                      <details><summary className="cursor-pointer text-xs text-accent">Reset password</summary>
                        <div className="mt-2"><ActionForm action={resetPassword.bind(null, u.id)} inline submitLabel="Reset"><label className="sr-only" htmlFor={`pw-${u.id}`}>New password</label><input id={`pw-${u.id}`} name="password" type="password" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" className="rounded-md border border-line-strong bg-surface px-2 py-1 text-sm" /></ActionForm></div>
                      </details>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card title="Add user">
        <ActionForm action={createUser} submitLabel="Create user" resetOnSuccess>
          <FormGrid>
            <TextField name="name" label="Name" required />
            <TextField name="email" label="Email" type="email" required autoComplete="off" />
            <Select name="role" label="Role" options={options(ROLE_LABELS)} defaultValue="OPERATOR" />
            <Select name="operatorId" label="Business (operators only)" options={operatorOpts} placeholder="—" />
            <TextField name="password" label="Initial password" type="password" required autoComplete="new-password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`} />
          </FormGrid>
        </ActionForm>
      </Card>
    </div>
  );
}
