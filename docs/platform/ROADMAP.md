# Roadmap, risks and milestones

Revised 2026-10-14 after the commercial and technical decisions on
pricing, hosting, security, account management, CI and Google Ads.

## 1. Priority order and status

| # | Priority (decision 2026-10-14) | Status | Evidence |
|---|---|---|---|
| 1 | Investigate and fix security vulnerabilities | ✅ Done. 0 production vulnerabilities, 0 critical. One dev-only high chain is a reviewed exception, due for re-review 2026-11-13 | [DEPENDENCY_SECURITY.md](DEPENDENCY_SECURITY.md), CI audit gates |
| 2 | Hosting, environment configuration, secrets, tenant isolation | 🟡 Designed and container-ready; **not provisioned** | [HOSTING.md](HOSTING.md), `Dockerfile`, tenant client + tests |
| 3 | Authentication, accounts, licences, configurable plan limits | ✅ Done | Starter/Professional/Enterprise in `prisma/catalogue/`, entitlement tests |
| 4 | Email verification, password reset, invitations, automated CI | ✅ Done in code; SES is unproven until an AWS account exists | `account.ts`, 16 integration tests, 31-check browser smoke test, `.github/workflows/` |
| 5 | Integration framework + GA4, Search Console, website connectors | ⏭ Next | Framework built; connectors pending |
| 6 | Initial agent workflows and evidence-backed reports | Planned | AGENT_REGISTER.md; usage allowance already enforces budgets |
| 7 | Advertising, social and booking connectors | Planned | INTEGRATIONS.md (Google Ads access path confirmed) |
| 8 | Self-service export, operational monitoring, production hardening | Planned | — |

Cross-cutting, already in place: AI usage allowance metering and limits
([USAGE_ALLOWANCE.md](USAGE_ALLOWANCE.md)); the audit log; the admin area.

## 2. Revised delivery plan

### Milestone A — Pilot-ready platform (priorities 2 + remaining 4)
Blocked on: an AWS account (your action).
1. Provision AWS Sydney per the HOSTING.md checklist: staging first, then production.
2. Confirm KMS / Secrets Manager / RDS settings in the console. Verify the
   SES domain (DKIM, SPF, DMARC) and request removal from the SES sandbox.
3. Fill in `deploy.yml` (OIDC, ECR push, migrate task, ECS rollout) and
   require approval on the `production` environment.
4. Branch protection on `main`: all CI jobs required; Dependabot enabled.
5. Run the smoke test against staging with real SES delivery to a test inbox.
6. Error monitoring with PII scrubbing; structured logs with a redaction list.

**Exit:** a customer can sign up, verify their email, start a Starter trial
and invite a colleague on staging, with mail delivered through SES and
deploys gated by CI.

### Milestone B — First intelligence integrations (priority 5)
1. pg-boss worker (separate ECS service); `SyncRun` table; idempotent
   jobs; per-provider concurrency limits.
2. Google OAuth (single-use hashed `state`, PKCE, encrypted refresh tokens,
   scope verification). Start **Google OAuth verification now**: it gates
   GA4, Search Console and later Ads.
3. GA4 connector, with property metadata (time zone, currency) and
   key-event detection.
4. Search Console connector.
5. Website crawler with an SSRF-safe fetcher (resolve-and-block private
   ranges on every hop), robots.txt, sitemaps, PageSpeed Insights.
6. Validation report (stage 4) from real checks; KPI baselines.
7. History window enforced from `limits.historyDays`; reporting cadences
   from `reporting.cadences`.

**Exit:** a pilot customer connects their own GA4, Search Console and site
on staging, and a baseline report is produced from real data.

### Milestone C — Agent workflows (priority 6)
Anthropic SDK; orchestrator with per-organisation advisory lock;
`assertAiBudget` → call → `recordModelUsage` on every call; Website,
Search & AI Visibility, Trend, Master, Chief of Staff, Content Strategy,
Results & Learning; evidence validator; action register; Weekly Brief;
eval suite including prompt-injection cases; usage-threshold emails to
owners.

### Milestone D — Advertising, social, booking (priority 7)
Google Ads (Cloud-project access path, Explorer → Basic), Meta Ads,
Instagram, Facebook, YouTube; booking CSV first, then the API provider
chosen from customer research.

### Milestone E — Production maturity (priority 8)
Self-service export, monitoring dashboards and alerting, RLS, nonce CSP,
MFA/SSO, penetration test, load tests, backup-restore drill, Stripe
billing (monthly first; annual plans, onboarding fees and add-ons as new
`Plan` rows / overrides when validated).

## 3. Commercial configuration (decision 2026-10-14)

| | Starter | Professional | Enterprise |
|---|---:|---:|---:|
| Price (indicative, NZD, excl. GST) | 299 / month | 699 / month | Custom |
| Brands / users / integrations | 1 / 2 / 3 | 3 / 5 / 6 | Custom (per agreement) |
| Scheduled reporting | Weekly | Daily or weekly | Configurable |
| History | 90 days | 12 months | Custom |
| Custom workflows | No | Limited (2) | Yes |
| Support | Standard | Priority | Dedicated |
| AI usage allowance (USD / month, planning) | 35 (stop at 100%) | 80 (stop at 110%) | 250 default, set per agreement |
| Self-serve trial | 30 days | Staff-provisioned | Staff-provisioned |

All of this is data in `prisma/catalogue/tourism.ts` (re-seed to apply),
overridable per licence by staff. Prices are hypotheses for validation.
Billing complexity is deferred: no payment provider until pricing is
validated with pilots.

## 4. Acceptance tests (current)

Automated, on every push (CI):

| Area | Tests |
|---|---|
| Auth & sessions | sign-up, normalisation, generic errors, rate limits, hashed tokens, expiry, revocation |
| Email verification | required for workspace and trial; single-use; expiry; reissue voids old links; bound to address; resend limit |
| Password reset | no enumeration; 30-min single-use; wrong-purpose token rejected; weak password doesn't burn the link; all sessions revoked; notice email; limits |
| Invitations | owner-only; verified inviter; licence required; seat counting incl. pending; replace/revoke/expire; only the invited address can accept; tenant-scoped revoke |
| Tenancy | cross-tenant read/write blocked at service and client level |
| Licensing | all licence states; features; limits; catalogue values pinned |
| AI allowance | pricing math; thresholds; idempotency; month rollover; tenant separation; overrides; refusals |
| Admin | staff-only; support read-only; audited licence and allowance changes; no credential exposure |
| Browser | 31-check end-to-end journey incl. real verification, invitation and reset emails |
| Supply chain | npm audit policy; gitleaks over full history; lockfile integrity; migration drift; container builds |

## 5. Decisions still open

| Decision | Depends on |
|---|---|
| Go-ahead to create the AWS organisation/accounts | You |
| Price validation and final limits | Pilot customer feedback and Phase C cost data |
| First booking provider | Customer research |
| Managed IdP for SSO/MFA | Enterprise demand |
| Anthropic zero data retention and AI processing location statement | Anthropic terms; professional privacy review |
| Legal documents (licence agreement, privacy policy, DPA, subprocessor list) | Legal review |

## 6. Risks

| Risk | Mitigation |
|---|---|
| Google OAuth verification and Ads access delays | Apply now; pilot in OAuth "testing" mode with named users; Explorer access first |
| AI data processed outside Australia | State it plainly (HOSTING.md §2); minimise prompt context; review ZDR |
| AI costs exceed allowance assumptions | Metering from day one; hard limits; tune allowances with Phase C data |
| SES sandbox / deliverability | Verify domain early; DKIM/SPF/DMARC; staging test inbox |
| Dev-only `braces` advisory lingers | Dependabot; monthly re-review; CI blocks any critical |
| Tenant isolation regressions in new tables | Add to `TENANT_MODELS`; isolation test per table; RLS in Milestone E |
| Provider API churn | Pinned versions, recorded-fixture contract tests |
| Single-maintainer operations | Managed services, IaC, runbooks, alerting |
