import Link from "next/link";
import { ButtonLink, Pill } from "@/components/platform/ui";
import { AGENTS } from "@/lib/agents/registry";
import { LIMIT_LABELS, mergeEntitlements, FEATURE_LABELS, type LimitKey } from "@/lib/platform/entitlements";
import { listCatalogue } from "@/lib/platform/licensing";
import { getCurrentUser } from "@/lib/web/session";

export const dynamic = "force-dynamic";

function price(cents: number | null, currency: string, interval: string) {
  if (cents == null) return "Pricing on request";
  const amount = new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(cents / 100);
  return `${amount} / ${interval === "YEAR" ? "year" : interval === "MONTH" ? "month" : "term"}`;
}

export default async function LandingPage() {
  const [user, catalogue] = await Promise.all([getCurrentUser(), listCatalogue()]);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-neutral-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-semibold tracking-tight">Tourism Intelligence</span>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <ButtonLink href="/workspaces">Go to your workspaces</ButtonLink>
          ) : (
            <>
              <Link href="/login" className="underline">
                Sign in
              </Link>
              <ButtonLink href="/signup">Get started</ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="py-16">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-400">Licensed AI intelligence ecosystems</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
            Purchase your AI ecosystem. Connect your business tools. Configure your goals. Activate your intelligence system.
          </h1>
          <p className="mt-5 max-w-2xl text-black/65 dark:text-white/65">
            A coordinated team of specialist AI agents that reads your own analytics, search, website, campaign and booking
            data, and turns it into evidence-backed, prioritised actions — with every claim traced to its source and every
            consequential step left to your approval.
          </p>
        </section>

        {catalogue.map((product) => (
          <section key={product.id} className="border-t border-black/10 py-12 dark:border-white/10">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{product.name}</h2>
              {product.versions[0] && <Pill>v{product.versions[0].version}</Pill>}
            </div>
            <p className="mt-2 max-w-3xl text-black/65 dark:text-white/65">{product.description}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {product.plans.map((plan) => {
                const e = mergeEntitlements(plan.entitlements, null);
                return (
                  <div key={plan.id} className="flex flex-col rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">{plan.description}</p>
                    <p className="mt-4 text-lg font-semibold">{price(plan.priceCents, plan.currency, plan.billingInterval)}</p>
                    {plan.selfServeTrial && plan.trialDays && <p className="text-xs text-teal-700 dark:text-teal-400">{plan.trialDays}-day pilot available</p>}
                    <ul className="mt-4 space-y-1 text-sm">
                      {(Object.entries(e.limits) as [LimitKey, number | null][]).map(([k, v]) => (
                        <li key={k}>
                          {v === null ? "Unlimited" : v} {LIMIT_LABELS[k]}
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-3 space-y-1 text-xs text-black/60 dark:text-white/60">
                      {Object.entries(e.features)
                        .filter(([, on]) => on)
                        .map(([k]) => (
                          <li key={k}>✓ {FEATURE_LABELS[k as keyof typeof FEATURE_LABELS]}</li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section className="border-t border-black/10 py-12 dark:border-white/10">
          <h2 className="text-xl font-semibold tracking-tight">The agents in the Tourism Intelligence ecosystem</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {AGENTS.map((a) => (
              <div key={a.key} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <p className="font-medium">{a.name}</p>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">{a.purpose}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-black/55 dark:text-white/55">
            Agents are being released in phases. Your workspace shows exactly which are live and what each one needs.
          </p>
        </section>
      </main>
    </div>
  );
}
