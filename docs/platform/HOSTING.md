# Hosting, data locations and environments

Decision (2026-10-14): initial target data region **Australia (Sydney)**,
subject to the verification below. Status: **recommended, not yet
provisioned.** Nothing here has been deployed.

## 1. Recommendation: AWS ap-southeast-2 (Sydney)

| Need | Service | Sydney availability | Verified how |
|---|---|---|---|
| Web app + background workers | ECS on Fargate (two services from the same image) | Yes | [AWS Fargate regions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate-Regions.html) |
| Database | RDS for PostgreSQL 16, Multi-AZ, PITR | Yes | [RDS Multi-AZ regions/engines](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RDS_Fea_Regions_DB-eng.Feature.MultiAZDBClusters.html) |
| Background jobs | pg-boss on the same Postgres (no extra service) | n/a — runs in our workers | — |
| Secrets | Secrets Manager | Yes | Regional service list (third-party aggregator) — **confirm in console** |
| Encryption keys | KMS (envelope encryption for `CREDENTIAL_ENCRYPTION_KEYS`, RDS/S3 at rest) | Not confirmed by search | **Confirm in console** before committing |
| Files (documents, crawl snapshots, exports) | S3 | Yes (S3 is regional) | Confirm with the bucket region at creation |
| Email | SES v2 | Yes — `email.ap-southeast-2.amazonaws.com` | [SES endpoints](https://docs.aws.amazon.com/general/latest/gr/ses.html) |
| Logs / metrics | CloudWatch Logs (region-local) | Yes | — |
| Images | ECR | Yes | — |
| Edge | ALB + AWS WAF (rate rules) | Yes | — |

**Why AWS:** every stateful component can live in one Australian region;
mature IAM (tasks get credentials from roles, no long-lived keys); KMS and
Secrets Manager for credential handling; SES in the same region. The main
cost is operational complexity, managed with infrastructure-as-code
(Terraform/OpenTofu) and the deploy gate in `.github/workflows/deploy.yml`.

**Alternatives considered:**

| Option | Verdict |
|---|---|
| Render | No Sydney region ([Render regions](https://render.com/docs/regions); Sydney is only a [feature request](https://feedback.render.com/features/p/sydney-region)). Excluded. |
| DigitalOcean (SYD1) | Simpler and cheaper. Viable fallback if AWS is too heavy; verify App Platform, Managed Postgres and Spaces availability in SYD1 first. Needs an external email provider. |
| Vercel (syd1 functions) + managed Postgres | Good for the web tier only; long-running sync/agent workers still need a container host, so it splits the platform. |

**Portability:** standard Postgres; a container image (`Dockerfile`, built
in CI); S3-compatible storage; email behind `src/lib/platform/email.ts`;
configuration only through environment variables. Moving providers means
re-pointing infrastructure, not rewriting the app.

## 2. Where data lives and where it is processed

| Data | Stored | Processed | Notes |
|---|---|---|---|
| Customer accounts, workspaces, profiles, connections, observations, findings, audit log | RDS, Sydney | ECS, Sydney | Primary store |
| Database backups / PITR | Sydney (RDS automated backups) | — | Optional cross-region copy to Melbourne (ap-southeast-4) — **verify** RDS backup-replication support before relying on it |
| Integration credentials | RDS (AES-256-GCM ciphertext); keys in KMS / Secrets Manager, Sydney | ECS, Sydney | Keys never leave AWS; decrypted only in memory |
| Files | S3, Sydney | — | |
| Application logs | CloudWatch Logs, Sydney | — | Must not contain tokens, credentials or customer content (see §5) |
| Transactional email | SES, Sydney | SES, Sydney → recipient mail servers anywhere | Email content is minimal: links, names, workspace names |
| **AI analysis (Claude API)** | Anthropic: workspace data-at-rest geography currently **US only** | `inference_geo` is `global` (default) or `us` — **no Australian option** | [Anthropic data residency](https://platform.claude.com/docs/en/manage-claude/data-residency). Prompts carry the minimum tenant context needed. |
| Provider data (Google, Meta, booking systems) | At the provider | At the provider | Fetched into Sydney by our workers |
| Source code, CI logs | GitHub (US) | GitHub Actions (US) | No customer data; CI uses throwaway test data |
| Error monitoring (planned) | Choose a vendor/region at selection | — | Scrub PII; prefer a vendor with an AU/EU option or self-host |
| Billing (Stripe, later) | Stripe | Stripe | Subprocessor |

**What we can truthfully say:** "Customer data is stored in Australia
(Sydney). Some processing, notably AI analysis by Anthropic, takes place
outside Australia." We **cannot** claim New Zealand data residency, or
Australia-only processing. **Professional review:** cross-border disclosure
under NZ Privacy Act IPP 12 and Australian APP 8, wording of the privacy
policy and DPA, and whether to offer Anthropic zero-data-retention
(requires an agreement with Anthropic).

## 3. Environments

| Environment | Purpose | Data | Keys |
|---|---|---|---|
| Local | Development | Synthetic only | Dev key ring in `.env` (git-ignored) |
| CI | Automated checks | Ephemeral Postgres containers | Generated per run |
| Staging | Release rehearsal, provider sandboxes | Synthetic / test accounts | Separate AWS account or isolated VPC, separate KMS keys |
| Production | Customers | Real | Production KMS keys; access via SSO + MFA only |

Separate AWS accounts for staging and production (AWS Organizations) are
recommended. Nobody gets standing production database access; break-glass
access is audited.

## 4. Configuration and secrets

| Variable | Source in production |
|---|---|
| `DATABASE_URL` | Secrets Manager (RDS-managed credentials with rotation) |
| `CREDENTIAL_ENCRYPTION_KEYS` | Secrets Manager, protected by KMS. Target state: KMS envelope encryption with per-tenant data keys, so the key ring stops being an env var |
| `APP_URL` | Task definition (plain) |
| `EMAIL_TRANSPORT=ses`, `EMAIL_FROM`, `SES_REGION=ap-southeast-2` | Task definition; SES access via the task IAM role |
| `ANTHROPIC_API_KEY` (Phase 3) | Secrets Manager |
| Google / Meta OAuth client secrets (Phase 2/4) | Secrets Manager |

`EMAIL_FILE_TRANSPORT_ALLOWED` must never be set in production; the app
refuses non-SES email in production without it.

## 5. Retention and deletion (operational)

- RDS automated backups: 14 days (proposed), PITR within that window.
- CloudWatch Logs: 90 days (application), 1 year (security / audit exports).
- S3: lifecycle rules per prefix (crawl snapshots 180 days; exports 7 days).
- Workspace deletion: the erasure job removes tenant rows and S3 objects
  and revokes provider tokens. Backups age out within the backup retention
  window, which the customer terms must state.
- Logging rules: never log request bodies, tokens, OAuth codes, email
  links or credential material. The app already avoids this; add a log
  scrubber when structured logging is introduced.

## 6. Indicative monthly cost at pilot scale (verify with the AWS Pricing Calculator)

| Item | Rough range (USD) |
|---|---|
| RDS PostgreSQL small instance, Multi-AZ, 20–50 GB | 70–150 |
| ECS Fargate: web (2 small tasks) + worker (1) | 40–90 |
| Application Load Balancer | 20–30 |
| NAT gateway (or VPC endpoints instead) | 35–50 (+ data) |
| WAF, CloudWatch, Secrets Manager, KMS, S3, ECR | 20–50 |
| SES | ~US$0.10 per 1,000 emails |
| **Total infrastructure** | **≈ US$200–400 / month** before AI usage |

AI model costs are metered per customer (USAGE_ALLOWANCE.md) and capped by
plan allowances.

## 7. Before onboarding enterprise customers

- Data processing agreement and subprocessor list (AWS, Anthropic, Google /
  Meta as data sources, GitHub for code only, Stripe when added).
- Security questionnaire answers (backed by this repo's SECURITY.md).
- Confirm whether the customer requires: Australian or New Zealand
  processing for AI (not currently possible with Anthropic's options),
  zero data retention, SSO / MFA, a custom retention period, or audit-log
  export.
- Incident-notification commitments that align with NZ/AU breach rules.
- Penetration test report (Phase 6).

## 8. Provisioning checklist (when approved)

1. AWS Organization with separate staging and production accounts;
   CloudTrail on; SSO with MFA.
2. Confirm KMS, Secrets Manager and RDS settings in ap-southeast-2 in the
   console (the two items above marked "confirm").
3. Terraform: VPC, RDS (encrypted, Multi-AZ, deletion protection), ECR,
   ECS cluster/services, ALB + ACM certificate, WAF, S3, KMS, Secrets
   Manager, SES domain identity (DKIM, SPF, DMARC) and leave the SES sandbox.
4. GitHub OIDC role for deploys; fill in `deploy.yml`; set
   `DEPLOY_ENABLED=true`; require approval on the `production` environment.
5. Run the migration task, then deploy web and worker; run the smoke test
   against staging.
