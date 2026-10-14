# Security, privacy and governance

This document records the controls that exist (and are tested) and the ones
still required before real customer data is collected. It is an engineering
document, **not** a statement of regulatory compliance; items marked
**Professional review** need a lawyer or privacy specialist.

## 1. Authentication

| Control | Implementation | Test |
|---|---|---|
| Password storage | scrypt (N=2¹⁵, r=8, p=1), per-user salt, self-describing format for future upgrades (`passwords.ts`) | `crypto.test.ts` |
| Password policy | ≥ 12 characters, ≤ 256 | `auth.test.ts` |
| Login enumeration | Same error and comparable timing (dummy hash) for unknown email vs. wrong password | `auth.test.ts` |
| Brute force | Postgres rate limits: 10 attempts / 15 min per account, 50 per IP, 10 sign-ups / hour per IP | `auth.test.ts` |
| Sessions | 256-bit random token in `__Host-` HttpOnly, Secure, SameSite=Lax cookie; only SHA-256 stored; 30-day absolute / 7-day idle expiry; individual and global revocation; disabled users rejected | `auth.test.ts`, browser smoke |
| CSRF | Server Actions are POST-only and Next.js checks Origin vs Host; SameSite=Lax cookie | framework |
| Platform roles | Only via `npm run admin:promote` (audited, revokes existing sessions); no web path can grant them | `auth.test.ts` (self-assignment ignored) |

| Email verification | Required before creating a workspace or starting a trial; 24 h single-use link bound to the address; resend rate-limited | `account.test.ts`, browser smoke |
| Password reset | 30-min single-use link; identical response for unknown addresses (email sent after the response); per-email and per-IP limits; all sessions revoked; "password changed" notice | `account.test.ts`, browser smoke |
| Invitations | Owner-only, verified inviter, licence and seat checks, 7-day single-use link, only the invited address can accept | `account.test.ts`, browser smoke |
| Email transport | SES (Sydney) with IAM-role credentials in production; production refuses other transports; no tracking pixels | `email.ts` |

Gaps before production: MFA/SSO (via managed IdP), a session list with
"sign out everywhere" in the UI, a breached-password check, and a change-email
flow (which must re-verify the new address).

## 2. Authorisation and tenant isolation

Three independent layers:

1. **Membership guard** — `getOrgContext()` resolves the workspace only if
   the user is a member; otherwise **404** (no existence oracle).
2. **Service checks** — role matrix (`permissions.ts`), licence access mode
   and features, plan limits. Read-only licences block anything that pulls
   data or spends money.
3. **Tenant-scoped client** — `tenantDb(orgId)` injects `organizationId` on
   every tenant-model query and throws `TenantIsolationError` if a query
   names another organisation, tries to move a row, or uses the
   `organization` relation directly.

| Role | View | Edit profile/brands/connections | Activate | Members, licence, delete |
|---|---|---|---|---|
| VIEWER | ✓ | | | |
| MEMBER | ✓ (+ notes on actions, Phase 3) | | | |
| ADMIN | ✓ | ✓ | ✓ | |
| OWNER | ✓ | ✓ | ✓ | ✓ |
| Platform SUPPORT | read-only cross-tenant, audited | | | |
| Platform SUPER_ADMIN | + licence management | | | |

Known limits: raw SQL bypasses the tenant client (only used in
`rate-limit.ts`, not tenant data); Postgres RLS planned for Phase 6;
background workers (Phase 2) must construct `tenantDb` from the job's
organisation id, never the global client.

## 3. Credential handling

- OAuth refresh tokens / API keys are encrypted with AES-256-GCM; AAD binds
  ciphertext to `(organizationId, connectionId, providerKey)` so a copied
  ciphertext fails to decrypt in another row.
- Versioned key ring; rotation = add a new version, re-encrypt in a job,
  remove the old version.
- Production: keys from a cloud KMS / secret manager (envelope encryption
  with per-tenant data keys is the target). Never in git, logs, model
  prompts or browser code.
- Display and staff queries never select `credentialsCiphertext` (tested).
- Disconnect destroys ciphertext immediately; from Phase 2 the connector
  also revokes the token at the provider.
- OAuth flows (Phase 2): `state` = single-use, hashed, short-lived, bound to
  user + org; PKCE where supported; exact redirect URIs; minimum scopes.

## 4. Threat model (STRIDE summary)

| Threat | Example | Mitigation | Status |
|---|---|---|---|
| Spoofing | Credential stuffing | Rate limits, generic errors, scrypt; MFA later | Built / MFA planned |
| Spoofing | Forged role cookie (old dev switcher) | Removed; roles derived from DB-backed sessions | Fixed |
| Tampering | Client edits org id / plan in a form | Org from membership; plan/status never from client; Zod validation | Built |
| Tampering | Cross-tenant write by id | Tenant client + `findFirst` scoped lookups | Built, tested |
| Repudiation | Disputed licence change | Audit log with actor, IP, before/after | Built |
| Information disclosure | Tenant A reads tenant B | Three-layer isolation | Built, tested |
| Information disclosure | Leaked DB dump yields sessions/tokens | Hashed session tokens; encrypted credentials with external keys | Built |
| Information disclosure | Unauthenticated legacy API (`/api/data-sources` exposed uploader emails) | Restricted to staff | Fixed |
| Denial of service | Login floods; expensive agent runs | Rate limits; per-plan run/budget limits (Phase 3); queue concurrency | Partial |
| Elevation | Customer reaches `/admin` | Server-side platform-role check, 404 | Built, tested |
| SSRF | Crawler pointed at internal hosts | Domain validation (no IPs/localhost/internal TLDs) now; resolve-and-check every fetch + egress proxy (Phase 2) | Partial |
| Prompt injection | Website/social/doc text instructs an agent | Untrusted content in delimited data blocks; agents have read-only tools only; outputs schema-validated; no consequential action without human approval; injection eval set | Phase 3 |
| Supply chain | Vulnerable npm deps, leaked secrets | Remediated 2026-10-14 (DEPENDENCY_SECURITY.md); CI audit gates, gitleaks, Dependabot | Built |
| Spoofing | Account takeover via reset / invite links | Hashed single-use expiring tokens bound to the address; rate limits; session revocation on reset | Built, tested |
| Abuse | Using invitations or resets to spam third parties | Owner-only, verified, licensed inviters; per-org and per-address limits | Built |
| Clickjacking | Framing the app | `X-Frame-Options: DENY`, `frame-ancestors 'none'` | Built |

## 5. Data flows

0. **Locations:** see HOSTING.md §2 for where each kind of data is stored and processed.
1. **Customer → app:** profile, knowledge, brands (stored in tenant rows).
2. **App → providers (Phase 2+):** worker uses decrypted token in memory
   only → read-only API → normalised observations in tenant rows.
3. **App → website (Phase 2):** public pages only, robots.txt respected,
   rate-limited, identifiable user agent.
4. **App → Claude API (Phase 3):** minimal necessary tenant context per
   step; no credentials, no traveller PII. **Professional review:**
   Anthropic commercial terms / data-retention settings, cross-border
   disclosure (NZ IPP 12) and customer contract wording.
5. **App → staff:** admin views, audited.

## 6. Retention, export and deletion

| Data | Retention (proposed) |
|---|---|
| Observations | Life of licence + 90 days, then deleted |
| Agent runs, findings, reports | Life of licence + 90 days |
| Audit events | 2 years (security investigations) |
| Sessions | Deleted 30 days after expiry/revocation (cleanup job, Phase 2) |
| Revoked connections | Row kept for history; credentials destroyed immediately |

- Deletion request (built): owner confirms by typing the name → workspace
  becomes inaccessible, all connections revoked immediately, audited.
  Erasure job (Phase 2): revoke provider tokens, delete tenant rows and
  object storage, record a tombstone; backups age out within the backup
  retention window (state this in the customer terms).
- Export: JSON/CSV export of all tenant data (Phase 2).
- **Professional review:** NZ Privacy Act 2020 (IPPs, notifiable breach
  rules), Australian Privacy Act if selling to AU, GDPR if any EU travellers'
  data is processed, provider terms (Google API Services User Data Policy
  incl. Limited Use; Meta Platform Terms), DPA/sub-processor list.

## 7. Backup and recovery

Managed Postgres with point-in-time recovery (target RPO ≤ 15 min, RTO ≤ 4 h),
encrypted backups in the same jurisdiction, quarterly restore drill
(Phase 6). Encryption keys backed up separately from data.

## 8. Incident response (outline)

1. Detect (error monitoring, audit anomalies such as failed-login spikes,
   provider revocation notices).
2. Triage severity; appoint an incident lead; preserve logs.
3. Contain: revoke sessions (`revokeAllSessions`), disable users, rotate
   encryption keys, revoke provider tokens, suspend affected licences.
4. Assess whether personal information was involved and whether it is a
   notifiable privacy breach (NZ: notify the Privacy Commissioner and
   affected people as soon as practicable). **Professional review** of the
   runbook.
5. Notify affected customers per contract; notify providers where their
   terms require (Google, Meta).
6. Post-incident review and corrective actions.

## 9. Security headers

`X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self';
form-action 'self'; object-src 'none'`, `nosniff`, strict referrer policy,
restrictive permissions policy, HSTS in production, `X-Powered-By` removed.
Nonce-based script CSP in Phase 6.

## 10. Deployment notes

- `X-Forwarded-For` is used for rate limiting and audit IPs; it must be set
  by our own load balancer (which overwrites client-supplied values).
- Separate dev / staging / production databases and key rings; tests refuse
  to run against a database whose name doesn't contain `test`.
