# Tourism AI Growth OS — product, architecture & status

**Outside In · Rotorua Tourism AI Growth Pilot.** Internal operating system for
delivering the 12-week pilot with ~10 Rotorua operators, the Tourism AI Growth
Collective, and the commercial model behind it.

This document is the source of truth for what exists, what is tested, what is
not built, and why. Last updated: 14 October 2026.

---

## 1. Product summary (recommendation)

Build the smallest platform that lets one founder run the pilot professionally
and prove (or disprove) value — not a marketplace, not an agent platform.

- **Primary user:** the founder. **Secondary:** a programme admin, and each
  operator through a narrow, read-mostly portal.
- **Core loop per operator:** assess → prioritise → implement → measure against
  a baseline → decide (scale / amend / stop) → report.
- **Collective loop:** workshops → shared initiatives (e.g. overnight packages)
  → shared experiments → documented, consented learnings.
- **Commercial loop:** pipeline kept honest (proposed ≠ quoted ≠ contracted ≠
  received), delivery costs, and cohort-economics scenarios.
- **Operator Growth Intelligence** (absorbed from the Tourism Growth
  Intelligence prototype): claim-typed signals → rules-based weekly brief →
  human approval → shared to the operator.

Everything else in the strategy (Rotorua Pulse, Open Experience Network, Stay
Another Night at destination scale, Rotorua Host) is NEXT/LATER and is
represented only as library records, an existing destination-data foundation,
and the experiment model's destination-level fields.

**Source note.** The "Rotorua Tourism AI Strategy — October 2026" document was
not found in the connected Google Drive or Notion. Strategic direction was taken
from the build brief's description of it, and from the "AI Agent Ecosystem" deck
(Te Puia/Waimangu) found in Drive. Please share the document so priorities can
be checked against it.

## 2. Audit of the starting repository (13 Oct 2026)

| Area | Found | Action taken |
|---|---|---|
| Stack | Next.js 16.3 App Router, React 19, Prisma 6 + Postgres, Tailwind 4, zod | Kept. No reason to change. |
| Product | "Rotorua Visitor Growth & Flow Intelligence" destination MVP: governed observation schema, CSV import, weather/holiday connectors (unverified), Scenario + AI Discovery engines | Preserved, moved under `/destination` (staff-only), labelled NEXT (Rotorua Pulse foundation). |
| Auth | **Critical:** unsigned `dev-role` cookie; anyone could set `ADMIN`. Role switcher in UI. | Removed. Real DB-session auth (§4). |
| API security | **`GET /api/data-sources` unauthenticated**; Scenario API allowed any logged-in role | Locked to staff. |
| Tests | None | Unit + DB integration + e2e (§8). |
| Related repo | `anigemmill/tourism-growth-agent` (TGI prototype, SQLite, single demo business) | Useful parts absorbed (§5.4); repo now reference-only. |

## 3. Architecture

```
Browser ──► Next.js 16 (App Router, server components + server actions)
              │  src/proxy.ts            optimistic cookie check only
              │  (app)/layout            requireStaff()   ─┐
              │  (portal)/layout         operator only     ├─ every page/action re-checks
              │  server actions          requireStaff/Founder + zod + audit
              │  src/lib/dal/portal.ts   actor-scoped queries for operators
              ▼
           Prisma ──► PostgreSQL (single database, single tenant)
```

- **No separate API layer.** Server components read via Prisma; mutations are
  server actions. Route handlers exist only for downloads (`/api/export`,
  `/api/reports`) and the legacy destination APIs.
- **Pure domain logic** in `src/lib/domain/*` (programme timeline,
  prioritisation, experiment evaluation, commercial maths, results comparison,
  weekly brief) — no I/O, fully unit-tested.
- **Integration boundary.** `src/lib/integrations/registry.ts` lists every
  operator data source with its pilot path (manual export) and what a live
  integration would need. Nothing is marked connected without a recorded,
  tested sync.
- **White-label ready, not multi-tenant.** Brand is design tokens in
  `src/app/globals.css`; destination facts in `src/config/destinations`. A
  second destination is a deploy + config, not a code fork. Multi-tenancy is
  deliberately not built (§9).

### Design system
Tokens on `:root` (light + dark): warm cream canvas, near-black ink, orange
(`--brand`, fill only — dark text on it for contrast), lime highlight, forest
green (`--accent`, links/positive), night cards. Instrument Serif display
headings with an italic lime-marked emphasis word, Geist Sans body, Geist Mono
for eyebrows and figures. Components: `src/components/ui/*` (PageHeader, Card,
Stat with orange/forest/night/lime variants, Badge, Table, Tabs, fields,
ActionForm, status badges).

## 4. Security & access model

| Role | Can |
|---|---|
| **FOUNDER** | Everything, incl. commercial, users, founder-only exports |
| **ADMIN** (programme admin) | All delivery data; no commercial, no user management |
| **OPERATOR** | `/portal` only: own business, own non-internal tasks/projects/opportunities/measurements, shared briefs, assessment if shared; cohort content marked COHORT+; initiatives they participate in; public directory fields of other operators |

- **Auth:** email + password, `scrypt` hashing (Node built-in), min 12 chars.
  Server-side sessions: random 256-bit token in an `httpOnly`, `SameSite=Lax`,
  `Secure` (production) cookie; only its SHA-256 is stored. 14-day expiry.
  Lockout after 8 failures / 15 min. Deactivation and password reset revoke
  sessions. Uniform error message (no account enumeration).
- **Authorisation is server-side:** every staff page and server action calls
  `requireStaff()`/`requireFounder()`; operator data is only read through
  `src/lib/dal/portal.ts`, whose queries are scoped by the session's
  `operatorId` — never by a request parameter.
- **Visibility levels** on records: INTERNAL, CONFIDENTIAL, COHORT,
  AGGREGATE_APPROVED, PUBLIC_APPROVED. Widening visibility checks the source
  operator's recorded consent and any cultural-review flag
  (`visibilityChangeError`).
- **Audit log** for logins, creates/updates (with diffs), visibility changes,
  decisions, exports, and a flagged `threshold_change` when an experiment's
  target/minimum is edited after it starts.
- Security headers (`X-Frame-Options: DENY`, nosniff, referrer policy,
  permissions policy). CSV exports neutralise spreadsheet formula injection.
  Password hashes and tokens are never exported.

## 5. Modules (what exists)

### 5.1 Delivery
- **Founder dashboard** (`/`): programme week/stage, overdue milestones, needs
  action now (high risks, overdue tasks, decisions due), opportunities by
  NOW/NEXT/LATER/IGNORE, key results (with verdicts), evidence still required,
  commercial snapshot (founder), synthetic-data banner.
- **Operators** (`/operators`): profile, grouping by type/stage/tag, workspace
  with roadmap, tasks, projects, results, experiments, collective, permissions &
  data-sharing, cultural guidance, logins.
- **AI assessments** (`/assessments`): nine areas, current capability 1–5,
  observed vs operator-reported fields; cannot complete with unscored areas.
- **Opportunity register** (`/opportunities`): all Module D fields, solution
  type (AI vs automation vs process vs website — "not everything needs AI"),
  transparent score (impact ÷ effort × confidence), evidence basis, horizon,
  decision; evidence panel; convert to project / task / experiment; reusable
  **solution templates** applied to many operators at once.
- **Projects & tasks** (`/work`): projects with tools, costs, testing notes,
  human go-live approval and adoption; task views (open/overdue/blocked/mine).

### 5.2 Programme & evidence
- **12-week programme** (`/programme`): configurable start date, length,
  stages (validated: ordered, non-overlapping) and milestones. All dates derive
  from start date + week, so moving the start reschedules everything.
- **Growth Collective** (`/collective`): workshops (agenda shared, notes
  internal, attendance + engagement), shared initiatives (participants,
  responsibilities, booking attribution method + attributed bookings/revenue,
  consent), learnings (visibility + cultural review gate), resources (links to
  existing storage), engagement table.
- **Experiments** (`/experiments`): hypothesis, audience, intervention, dates,
  baseline period, comparison method, primary/secondary metrics, minimum
  acceptable, target, max cost, results, limitations, attribution notes,
  destination-level incremental visitors / nights / spend kept separate,
  decision. Rules: thresholds required before running; re-runs must state what
  changed; limitations required to complete. Mechanical verdict + caveats.
- **Baselines & results** (`/results`): manual entry and authorised,
  all-or-nothing CSV import; latest baseline vs latest result per metric.

### 5.3 Intelligence & governance
- **Reports** (`/reports`): founder, operator, cohort (anonymised, consenting
  operators only), experiment, monthly commercial, case-study draft (blocked
  without case-study consent). Findings answer what changed / evidence / why /
  next / owner / review date. Print-to-PDF and Markdown download.
- **Agent & workflow library** (`/library`): kind (concept/spec, prompt
  template, automated workflow, functioning agent) is separate from status
  (concept → testing → validated → operational). Validated/operational require
  recorded test results; operational requires a human-approval statement.
  Versioned instructions, operator usage. Seeded with honest records for
  Tourism Growth Intelligence, Rotorua Visitor Growth & Flow and three
  pilot workflows.
- **Commercial** (`/commercial`, founder): deals by type and stage, payments
  (only on contracted deals), delivery/software costs (actual vs forecast,
  monthly), margin, renewals, pricing & cohort-size scenarios compared side by
  side. NZD excl. GST. Not accounting.
- **Governance** (`/governance`): risks/blockers/issues, decision log,
  controls summary; audit log; data export (per dataset CSV/JSON, full JSON).
- **Users & access** (`/settings/users`, founder).

### 5.4 Operator Growth Intelligence (absorbed from TGI)
Ported from `anigemmill/tourism-growth-agent`: the Signal model with
FACT / OBSERVATION / INFERENCE / HYPOTHESIS / RECOMMENDATION claim types, the
integrations registry, and the daily-brief builder (now a weekly Scan → Brief →
Learn). Changes made while porting:
- The registry no longer marks a source CONNECTED because an env var exists.
- Briefs are persisted DRAFT → APPROVED → SHARED; operators only see SHARED.
- Operators can submit observations from their portal (attributed to their
  own business from the session).
- Not ported: per-business multi-tenancy, the 8-factor scoring rubric (kept the
  simpler 3-factor one to avoid two competing scores), LLM website analysis,
  competitor tracking, content briefs. These are backlog candidates.

### 5.5 Destination data (NEXT)
The original destination-intelligence modules are intact under `/destination`
(staff-only): see `docs/ARCHITECTURE.md` and `docs/CONNECTOR_STATUS.md`.

## 6. Data model (summary)

Full schema: `prisma/schema.prisma` (migrations in `prisma/migrations`).

- **Identity:** User (role, operatorId), AuthSession (token hash), LoginAttempt, AuditLog
- **Programme:** Programme, ProgrammeStage, Milestone
- **Operators:** Operator (profile + consents + cultural guidance + isSynthetic)
- **Assessment:** Assessment, AssessmentAreaScore
- **Register:** Opportunity, SolutionTemplate, Project, Task, Evidence (polymorphic)
- **Collective:** Workshop, WorkshopAttendance, Learning, Resource, SharedInitiative, InitiativeParticipant
- **Evidence:** Experiment, Measurement
- **Intelligence:** Signal, IntegrationConnection, GrowthBrief
- **Governance:** Risk, DecisionRecord
- **Library:** WorkflowAsset, WorkflowVersion, WorkflowUsage
- **Commercial:** Deal, Payment, CostItem, PricingScenario
- **Destination (existing):** see `docs/ARCHITECTURE.md`

Synthetic/illustrative data is flagged in the schema (`Operator.isSynthetic`,
`isIllustrative` on Measurement, Experiment, Signal, Deal, CostItem) and badged
everywhere it appears.

## 7. Privacy, trust & cultural governance

Implemented as workflow controls (not proof of legal compliance): consent
fields per operator; consent-gated visibility; cultural-review flag that blocks
sharing until an authority is named; per-operator cultural guidance shown on
their workspace and assessment; no guest personal data fields (forms warn);
human approval before AI-derived briefs reach operators; audit trail; full
export as a low-tech fallback; retention notes per operator.

**Not yet implemented:** automated retention/deletion jobs, a formal
correction-request workflow beyond "contact your programme lead", privacy
policy text. Get NZ Privacy Act 2020 advice before onboarding real operators.

## 8. Testing — what is verified

| Suite | Command | Covers | Result (14 Oct) |
|---|---|---|---|
| Unit | `npm test` | timeline, stage validation, scoring, experiment verdicts & caveats, commercial separation, scenarios, results comparison, weekly brief, authz rules, consent gate, CSV escaping | 12/12 pass |
| Integration (Postgres) | `TEST_DATABASE_URL=… npm run test:integration` | operator A cannot read B's opportunities/tasks/measurements/learnings/experiments/briefs; internal notes never exposed; unlinked/staff actors rejected by DAL; login success stores only token hash; wrong password / deactivated / unlinked → same error; lockout; expired session removal | 8/8 pass |
| E2E (browser) | `E2E_BASE_URL=… node tests/e2e/workflows.e2e.cjs` | login errors; admin blocked from commercial/users/founder exports; create operator; consent gate; signal + draft brief; assessment completion gate; opportunity → project → task; measurement; experiment threshold gate; library status gate; deal stage rule; full export excludes credentials; markdown report; operator blocked from exports/reports; operator update; logout | 25/25 pass (dev and production builds) |

Also: `npm run lint` clean, `tsc` clean, `next build` succeeds, every page
smoke-tested as founder and operator; mobile (390px) has no horizontal scroll.

## 9. Prioritised backlog

**NOW (before real operators)**
1. Deploy to a managed host with HTTPS + managed Postgres + backups; seed founder only (no demo).
2. Privacy: plain-language data-use statement, retention schedule, correction process; legal check.
3. Operator onboarding: founder creates operator accounts; consider magic-link or SSO instead of shared initial passwords.
4. Replace synthetic cohort with real operators; record baselines in weeks 1–2.
5. Password change by the user themselves (currently founder resets).

**NEXT**
6. Recurring intelligence service: optional LLM drafting of brief "why it matters" (Claude API, human-approved, inputs logged).
7. Rotorua Pulse: monthly cohort/destination report combining cohort aggregate + `/destination` data.
8. Stay Another Night experiment template with partner attribution codes.
9. Email notifications (overdue tasks, brief shared) via a transactional provider.
10. File attachments for evidence (currently links to Drive/Notion).

**LATER**
11. Booking-system exports via API for consenting operators; verified bookable experience data (Open Experience Network).
12. Rotorua Host prototype; multi-destination/tenant licensing.

**IGNORE (for now)**
Public marketplace, autonomous agents, custom booking integrations for every operator, social network/messaging, custom models.

## 10. Risks & decisions needing your input

1. **Strategy document missing** — please share it; priorities may shift.
2. **Hosting & data residency** — choose host/region (NZ/AU preferred for operator data?).
3. **Commercial is founder-only** (admin cannot see it). Reversible; confirm.
4. **Operator login method** — passwords now; magic links need an email provider.
5. **Pricing assumptions** in seeded scenarios are illustrative placeholders.
6. **Te Puia "12 agents, all live" deck** — not reflected as operational in the library because it isn't integrated or tested here.

## 11. Setup

```bash
npm install
cp .env.example .env            # set DATABASE_URL, SEED_FOUNDER_EMAIL/PASSWORD
npx prisma migrate deploy
npm run db:seed                 # add SEED_DEMO=true for a synthetic demo cohort
npm run dev                     # http://localhost:3000
```

Demo seed (`SEED_DEMO=true`) creates `admin@demo.example`,
`operator1@demo.example` (Lakeside Retreat Lodge) and `operator2@demo.example`
(Redwoods Ridge Bike Tours) with `SEED_DEMO_PASSWORD` (or a printed random one).

## 12. Deployment

- Any Node 20+ host that runs `next build && next start` (Vercel, Render,
  Railway, Fly, a VM). Managed Postgres with automated backups.
- Env: `DATABASE_URL` (TLS), `NODE_ENV=production`. Seed vars only for first run.
- Release: `npm ci && npx prisma migrate deploy && npm run build && npm start`.
- HTTPS is required (session cookie is `Secure` in production).
- Run `npm test` and the integration suite (against a disposable DB) in CI
  before each deploy.
- Never set `SEED_DEMO=true` on a database holding real operator data.

## 13. Phase report

| Phase | Implemented | Tested | Incomplete / known issues |
|---|---|---|---|
| 1 Audit & foundation | Audit, architecture, design system (tokens + components, redesigned to brand references), destination modules preserved | Build, lint, typecheck | Strategy doc not reviewed (not found) |
| 2 Core platform | Auth, roles, DAL, audit, dashboard, operators, assessments, register, projects/tasks, portal, Growth Intelligence | Unit, integration, e2e | Self-service password change; SSO |
| 3 Programme & intelligence | Programme, collective, experiments, results + CSV import, reports, library | Unit (logic), e2e (gates), smoke | No file uploads; no scheduled reports; no LLM features in Growth OS |
| 4 Commercial | Deals, payments, costs, scenarios, commercial report | Unit (maths), e2e (stage rule) | No invoicing/accounting (by design) |
| 5 Quality & release | Tests, export, headers, docs | All suites green | Not yet deployed; no CI pipeline configured; accessibility checked manually (labels, focus, contrast tokens) — no automated a11y audit yet |

**Recommended next step:** decide hosting (§10.2), deploy with founder-only
seed, and run the first real operator onboarding through the app in a
dry run before the cohort starts.
