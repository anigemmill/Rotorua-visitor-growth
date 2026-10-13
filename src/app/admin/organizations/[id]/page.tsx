import { notFound } from "next/navigation";
import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { PageHeader, Panel, Pill, formatDate } from "@/components/platform/ui";
import { getOrganizationDetail, listAuditEvents, listPlans } from "@/lib/platform/admin";
import { NotFoundError } from "@/lib/platform/errors";
import { STAGE_LABELS } from "@/lib/platform/onboarding";
import { canManagePlatform } from "@/lib/platform/permissions";
import { requireStaffUser } from "@/lib/web/session";
import { setLicenseAction } from "../../actions";

const dateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function OrganizationDetailPage({ params }: PageProps<"/admin/organizations/[id]">) {
  const { id } = await params;
  const staff = await requireStaffUser();
  const org = await getOrganizationDetail(staff, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [products, audit] = await Promise.all([listPlans(), listAuditEvents({ organizationId: id, take: 50 })]);
  const plans = products.flatMap((p) => p.plans.map((pl) => ({ value: pl.key, label: `${p.name} — ${pl.name}` })));
  const current = org.licenses[0];

  return (
    <>
      <PageHeader
        title={org.name}
        description={
          <>
            /{org.slug} · {STAGE_LABELS[org.onboardingStage]} · created {formatDate(org.createdAt)}
            {org.status !== "ACTIVE" && (
              <span className="ml-2">
                <Pill tone="bad">{org.status}</Pill>
              </span>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Licences">
          {org.licenses.length === 0 && <p className="text-sm text-black/60">No licence.</p>}
          {org.licenses.map((l) => (
            <div key={l.id} className="text-sm">
              <p className="font-medium">
                {l.product.name} — {l.plan.name} <Pill tone={l.access.mode === "full" ? "good" : "warn"}>{l.status}</Pill>
              </p>
              <p className="text-black/60">
                Access: {l.access.mode} ({l.access.reason}) · trial ends {formatDate(l.trialEndsAt)} · period ends{" "}
                {formatDate(l.currentPeriodEnd)} · grace {l.graceDays}d
              </p>
              {l.notes && <p className="mt-1 text-black/60">Notes: {l.notes}</p>}
            </div>
          ))}
        </Panel>

        {canManagePlatform(staff.user.platformRole) && (
          <Panel title={current ? "Update licence" : "Grant licence"}>
            <ActionForm action={setLicenseAction}>
              <input type="hidden" name="organizationId" value={org.id} />
              <Field name="planKey" label="Plan" required options={plans} defaultValue={current?.plan.key} />
              <Field
                name="status"
                label="Status"
                required
                defaultValue={current?.status ?? "ACTIVE"}
                options={["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED", "SUSPENDED"].map((s) => ({ value: s, label: s }))}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field name="trialEndsAt" label="Trial ends" type="date" defaultValue={dateInput(current?.trialEndsAt)} />
                <Field name="currentPeriodEnd" label="Period ends" type="date" defaultValue={dateInput(current?.currentPeriodEnd)} />
                <Field name="graceDays" label="Grace days" type="number" defaultValue={String(current?.graceDays ?? 7)} />
              </div>
              <Field name="notes" label="Internal notes" multiline defaultValue={current?.notes} />
              <FormStatus />
              <SubmitButton>Save licence</SubmitButton>
            </ActionForm>
          </Panel>
        )}

        <Panel title="Members">
          <ul className="text-sm">
            {org.memberships.map((m) => (
              <li key={m.id} className="flex justify-between py-1">
                <span>
                  {m.user.name} · {m.user.email}
                </span>
                <span className="text-black/60">
                  {m.role} · last login {formatDate(m.user.lastLoginAt, true)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Connections">
          {org.integrations.length === 0 ? (
            <p className="text-sm text-black/60">None.</p>
          ) : (
            <ul className="text-sm">
              {org.integrations.map((c) => (
                <li key={c.id} className="py-1">
                  {c.providerKey} · {c.externalAccountId} · <Pill tone={c.status === "ERROR" ? "bad" : "neutral"}>{c.status}</Pill>
                  {c.lastErrorMessage && <span className="ml-2 text-red-600">{c.lastErrorMessage}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Profile">
          <p className="text-sm">
            {org.profile?.businessName} · {org.profile?.website ?? "no website"} · {org.profile?.country ?? "—"} ·{" "}
            {org.profile?.timeZone ?? "—"}
          </p>
          <p className="mt-1 text-sm text-black/60">Brands: {org.brands.map((b) => b.name).join(", ") || "none"}</p>
        </Panel>

        <Panel title="Recent audit events">
          <ul className="space-y-1 text-xs">
            {audit.map((e) => (
              <li key={e.id}>
                {formatDate(e.createdAt, true)} · <span className="font-mono">{e.action}</span> · {e.actorEmail ?? "—"}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
