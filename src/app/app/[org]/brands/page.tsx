import { ActionForm, Field, FormStatus, SubmitButton } from "@/components/platform/forms";
import { PageHeader, Panel } from "@/components/platform/ui";
import { limitFor } from "@/lib/platform/entitlements";
import { getLicenseState } from "@/lib/platform/licensing";
import { listBrands } from "@/lib/platform/onboarding";
import { roleCan } from "@/lib/platform/permissions";
import { requireOrg } from "@/lib/web/session";
import { addBrandAction, deleteBrandAction } from "../actions";

export default async function BrandsPage({ params }: PageProps<"/app/[org]/brands">) {
  const { org } = await params;
  const ctx = await requireOrg(org);
  const [brands, license] = await Promise.all([listBrands(ctx), getLicenseState(ctx.db)]);
  const canManage = roleCan(ctx.role, "brands.manage");
  const max = license.license ? limitFor(license.entitlements, "brands") : 1;

  return (
    <>
      <PageHeader
        title="Brands"
        description={`Separate brands, products lines or locations you market under. Your plan allows ${max === null ? "unlimited" : max} brand${max === 1 ? "" : "s"}.`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your brands">
          {brands.length === 0 ? (
            <p className="text-sm text-black/60 dark:text-white/60">No brands yet.</p>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {brands.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    {b.website && <p className="text-black/60 dark:text-white/60">{b.website}</p>}
                    {b.description && <p className="mt-1 text-black/60 dark:text-white/60">{b.description}</p>}
                  </div>
                  {canManage && (
                    <ActionForm action={deleteBrandAction} className="" confirm={`Remove ${b.name}?`}>
                      <input type="hidden" name="org" value={ctx.organization.slug} />
                      <input type="hidden" name="brandId" value={b.id} />
                      <SubmitButton variant="secondary">Remove</SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {canManage && (
          <Panel title="Add a brand">
            <ActionForm action={addBrandAction} resetOnSuccess>
              <input type="hidden" name="org" value={ctx.organization.slug} />
              <Field name="name" label="Brand name" required />
              <Field name="website" label="Website" type="url" placeholder="https://" />
              <Field name="description" label="Short description" multiline />
              <FormStatus />
              <SubmitButton>Add brand</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
