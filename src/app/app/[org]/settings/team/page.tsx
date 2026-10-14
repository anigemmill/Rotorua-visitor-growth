import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { PageHeader, Panel, Pill, formatDate } from "@/components/platform/ui";
import { listPendingInvitations } from "@/lib/platform/account";
import { MEMBERSHIP_ROLE_LABELS, roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { inviteMemberAction, removeMemberAction, revokeInvitationAction } from "../../actions";

export default async function TeamPage({ params }: PageProps<"/app/[org]/settings/team">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const members = await ctx.db.membership.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const canManage = roleCan(ctx.role, "members.manage");
  const invitations = canManage ? await listPendingInvitations(ctx) : [];

  return (
    <>
      <PageHeader
        title="Team"
        description="Owners manage the team and licence. Admins configure the workspace. Members and viewers can read reports."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Members">
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{m.user.name}</p>
                  <p className="text-black/60 dark:text-white/60">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Pill>{MEMBERSHIP_ROLE_LABELS[m.role]}</Pill>
                  {canManage && m.userId !== ctx.user.id && (
                    <ActionForm action={removeMemberAction} className="" confirm={`Remove ${m.user.email}?`}>
                      <input type="hidden" name="org" value={ctx.organization.slug} />
                      <input type="hidden" name="membershipId" value={m.id} />
                      <SubmitButton variant="secondary">Remove</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        {canManage && (
          <div className="space-y-6">
          <Panel title="Invite someone" description="We'll email them a link that expires in 7 days. Pending invitations count towards your plan's user limit.">
            <ActionForm action={inviteMemberAction} resetOnSuccess>
              <input type="hidden" name="org" value={ctx.organization.slug} />
              <Field name="email" label="Email" type="email" required />
              <Field
                name="role"
                label="Role"
                required
                defaultValue="VIEWER"
                options={[
                  { value: "VIEWER", label: "Viewer — read only" },
                  { value: "MEMBER", label: "Member — read and comment" },
                  { value: "ADMIN", label: "Admin — configure the workspace" },
                ]}
              />
              <FormStatus />
              <SubmitButton>Send invitation</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title="Pending invitations">
            {invitations.length === 0 ? (
              <p className="text-sm text-black/60 dark:text-white/60">None.</p>
            ) : (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-black/60 dark:text-white/60">
                        {MEMBERSHIP_ROLE_LABELS[inv.role]} · expires {formatDate(inv.expiresAt)}
                      </p>
                    </div>
                    <ActionForm action={revokeInvitationAction} className="" confirm={`Withdraw the invitation to ${inv.email}?`}>
                      <input type="hidden" name="org" value={ctx.organization.slug} />
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <SubmitButton variant="secondary">Withdraw</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          </div>
        )}
      </div>
    </>
  );
}
