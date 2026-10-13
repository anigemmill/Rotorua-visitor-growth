# Roadmap, risks and milestones

## 1. Implementation sequence

| Phase | Scope | Exit criteria |
|---|---|---|
| 0 Discovery & architecture | These documents | ✅ Done |
| 1 Platform foundation | Auth, workspaces, tenancy, licensing & entitlements, onboarding stages 1–5 (UI), connection centre, admin, audit, security headers | ✅ Built — see §4 |
| 2 First integrations | pg-boss worker; GA4 + Search Console OAuth connectors; website crawler + sitemaps + PageSpeed; observation/metric-definition tables; validation checks (stage 4); baselines; export; erasure job; email provider (verify/reset/invite) | A pilot customer connects their own GA4, GSC and site; validation report shows real gaps; baseline report generated from real data |
| 3 Agent orchestration | Anthropic SDK; workflow runner; Website, Search & AI Visibility, Trend, Master, Chief of Staff, Content Strategy, Results & Learning; evidence validator; action register; Weekly Brief and Website & Search Report; usage ledger & budgets; eval suite; activation with explicit consent | Weekly brief generated end-to-end for two tenants with zero unsourced facts on the eval set |
| 4 Advertising & social | Google Ads, Meta Ads, Instagram/Facebook/YouTube connectors; Paid Campaign + Social agents; Campaign report with attribution caveats | Provider approvals granted; connectors pass auth/permission/error tests |
| 5 Booking & revenue | Booking interface; CSV import; first provider (Rezdy, pending research); Visitor Growth + Pricing & Revenue agents; Commercial report | Attributed vs. observed bookings separated in reports |
| 6 Production readiness | Security review/pen test, RLS, nonce CSP, MFA/SSO, monitoring, backups + restore drill, load tests, Stripe billing, dependency triage, docs, deployment automation, pilot acceptance tests | §5 criteria demonstrated |

## 2. Backlog (next, in order)

1. Email provider: verification, password reset, invitations (closes Phase 1 auth gaps).
2. pg-boss worker process + `SyncRun`; session/rate-limit cleanup jobs.
3. Google OAuth (state, PKCE, encrypted refresh token, scope check) shared by GA4/GSC.
4. GA4 connector (+ property metadata, key-event detection) with recorded-fixture tests.
5. Search Console connector.
6. Website crawler with SSRF-safe fetcher, sitemap parser, issue detectors.
7. Validation report (stage 4) from real checks; baselines.
8. Data export and erasure job.
9. Plan editor in admin; Prisma config migration (`prisma.config.ts`).
10. CI pipeline (lint, typecheck, unit + integration tests with Postgres service, build).

## 3. Decisions

**Made now (reversible, documented):** stack (§ARCHITECTURE 3); Organization
as tenant; tenant-scoped client + service checks; own session auth for the
pilot; read-only integrations only; self-orchestrated Claude workflows;
pg-boss for jobs; prices unset and plan limits provisional; destination
dashboard staff-only.

**Depend on you / external parties:**

| Decision | Depends on |
|---|---|
| Pricing, trial length, plan limits | Pilot cost data and customer research |
| Hosting provider and data region (NZ/AU) | Your preference, customer requirements |
| First booking provider | Customer research (which systems prospects use) |
| Managed IdP for SSO/MFA | Enterprise demand |
| Exact Google Ads / Meta access path | Provider approvals (see INTEGRATIONS.md) |
| Model tier per agent | Phase 3 eval results and budget |
| Licence agreement, privacy policy, DPA, terms | Legal review |
| Whether the Rotorua destination dashboard becomes a licensed "Destination ecosystem" product | Product strategy |

## 4. Phase 1 milestone — acceptance tests

| # | Criterion | Evidence |
|---|---|---|
| 1 | A new customer can sign up, create a workspace and start a licence (pilot) | Browser smoke; `licensing.test.ts` |
| 2 | Weak/duplicate sign-ups rejected; login errors don't reveal accounts; brute force rate-limited | `auth.test.ts` |
| 3 | Sessions are hashed, expire (absolute + idle), revoke on logout and on user disable | `auth.test.ts`, smoke |
| 4 | Tenant A cannot read or mutate tenant B's data by slug, id or direct client misuse | `tenancy.test.ts`, smoke (404) |
| 5 | Role matrix enforced server-side (viewer cannot edit; last owner protected) | `licensing.test.ts`, `permissions.test.ts`, smoke |
| 6 | Licence modes: trial, active, grace, past due, cancelled, expired, suspended resolve correctly; read-only blocks data pulls | `entitlements.test.ts`, `licensing.test.ts` |
| 7 | Plan limits for brands, users, integrations enforced; features not in plan refused | `licensing.test.ts`, smoke |
| 8 | Admin area is staff-only; SUPPORT read-only; licence changes and customer views audited | `admin.test.ts`, smoke |
| 9 | Credentials encrypted, rotation-capable, bound to their row; never shown in UI or staff views | `crypto.test.ts`, `admin.test.ts` |
| 10 | Onboarding profile and knowledge validated, saved, tenant-isolated; stages only advance | `tenancy.test.ts`, `licensing.test.ts`, smoke |
| 11 | Website domain input rejects IPs/localhost/internal names | `tenant-scope.test.ts`, smoke |
| 12 | Planned integrations and agents are shown honestly; nothing displays sample data as real | Manual review, smoke |

Run: `npm test` (72 tests), `npm run lint`, `npm run typecheck`,
`npm run build`; browser smoke: `tests/e2e/smoke.cjs`.

**Not met yet / remaining gaps for Phase 1:** email verification, password
reset and invitations (need an email provider); self-service data export;
plan editor; CI pipeline.

## 5. Commercial success criteria (brief §15) — status

| Criterion | Status |
|---|---|
| 1 New customer can create an account and activate a valid licence | ✅ (pilot self-serve; paid via staff) |
| 2 Connect own GA4 & Search Console securely | Phase 2 |
| 3 Crawl website and sitemap | Phase 2 |
| 4 Validate data availability, identify missing information | Phase 2 |
| 5 Evidence-backed reports | Phase 3 |
| 6 Prioritised, measurable recommendations | Phase 3 |
| 7 Customer data isolated | ✅ for Phase 1 data; re-test per new table |
| 8 Failed connections / incomplete reports handled transparently | Partially (UI states); Phase 2–3 |
| 9 Usage and cost measured per customer | Phase 3 |
| 10 Second customer onboarded without rebuilding | ✅ (self-serve workspaces) |
| 11 Supports more integrations and ecosystem products | ✅ by design (registry, Product/Plan) |
| 12 Route from assisted pilot to repeatable SaaS | Staff licence tooling ✅; billing Phase 6 |

The product is **not** commercially ready; it is a working, secured
foundation.

## 6. Risks and dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| Google sensitive-scope verification / Ads access delays | Blocks GA4/GSC public launch, Ads | Start verification now; pilot in OAuth "testing" mode with ≤100 named users |
| Meta App Review rejection or tier limits | Blocks Meta/Instagram | Apply early with screencasts; social is Phase 4 |
| Provider API/metric churn | Broken syncs, wrong metrics | Pinned API versions, contract tests on recorded fixtures, `MetricDefinition` table |
| LLM cost per tenant exceeds price | Margin | Usage ledger, budgets per plan, batching, caching, deterministic pre-processing |
| Hallucinated or overconfident findings | Trust, liability | Evidence validator, eval suite, approval gates, impact always "estimated" |
| Prompt injection via crawled content | Data leakage / bad advice | Read-only tools, data/instruction separation, injection evals |
| Tenant isolation regression in new tables | Severe | Add every tenant table to `TENANT_MODELS`; isolation test per table; RLS in Phase 6 |
| Thin booking API availability | Phase 5 scope | CSV first; customer research before choosing a provider |
| Legal/privacy obligations | Launch blocker | Professional review items in SECURITY.md |
| Single-developer operations | Reliability | Managed infra, monitoring, runbooks |

## 7. Cost considerations (per month, indicative — verify with providers)

- **Fixed:** managed Postgres with PITR, app + worker containers, object
  storage, error monitoring, email provider — low hundreds of USD at pilot
  scale.
- **Variable per tenant:** Claude usage dominates. Current list prices:
  Opus 5.5 $4 / $20 per million input/output tokens, Sonnet 5.5 $2 / $10,
  Haiku 5.5 $0.10 / $0.50; Batches are 50% cheaper; cache reads are much
  cheaper than fresh input. A weekly cycle's real cost must be measured in
  Phase 3 before prices are set — plan budgets (`monthlyModelBudgetUsd`) cap
  exposure meanwhile.
- **Provider APIs:** Google/Meta reporting APIs have no per-call fee but
  have quotas; PageSpeed Insights is free within quota; Rezdy API access may
  require a higher customer plan.
