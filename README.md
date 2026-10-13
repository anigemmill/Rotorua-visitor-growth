# Tourism Intelligence Platform

A multi-tenant SaaS platform that licenses complete AI agent ecosystems to
businesses. The first product is the **Tourism Intelligence Ecosystem**:
customers buy a licence, create a workspace, describe their business,
connect their own tools (read-only), and a coordinated set of specialist
agents turns that data into evidence-backed, prioritised actions.

**Current state: Phase 1 (platform foundation) is built and tested.**
Provider connectors (Phase 2), agent orchestration (Phase 3) and later
phases are designed but not built — the app says so rather than showing
sample data.

Platform documentation lives in [`docs/platform/`](docs/platform/):
[architecture](docs/platform/ARCHITECTURE.md) ·
[data model](docs/platform/DATA_MODEL.md) ·
[security](docs/platform/SECURITY.md) ·
[integrations](docs/platform/INTEGRATIONS.md) ·
[agent register](docs/platform/AGENT_REGISTER.md) ·
[roadmap, risks & acceptance tests](docs/platform/ROADMAP.md).

## Quick start

```bash
npm install
cp .env.example .env     # set DATABASE_URL, CREDENTIAL_ENCRYPTION_KEYS, TEST_DATABASE_URL
npx prisma migrate dev
npm run db:seed          # catalogue (products/plans) + destination reference data; no customer data
npm run dev
```

1. Open http://localhost:3000, create an account and a workspace.
2. Start the 30-day pilot under **Licence & plan**, then work through
   onboarding (profile → knowledge → connections → validation → activation).
3. To use the admin area, promote an account (there is no web path to do this):
   `npm run admin:promote -- you@example.com SUPER_ADMIN`, then sign in again
   and open `/admin`.

## Checks

```bash
npm test            # Vitest: unit + integration tests against TEST_DATABASE_URL (must contain "test")
npm run lint
npm run typecheck
npm run build
node tests/e2e/smoke.cjs   # browser smoke test against a running server (needs playwright)
```

## Layout

| Path | What |
|---|---|
| `src/lib/platform/` | Domain services: auth, sessions, organisations, tenant-scoped db, licensing/entitlements, onboarding, connections, admin, audit, crypto, rate limiting |
| `src/lib/integrations/` | Connector contract and integration catalogue |
| `src/lib/agents/` | Agent register and workflow stages |
| `src/lib/web/` | Next.js guards (session cookie → user → workspace/staff context) and action helpers |
| `src/app/(auth)`, `src/app/workspaces`, `src/app/app/[org]` | Customer application |
| `src/app/admin` | Platform admin (staff only) |
| `src/app/destination` | Original Rotorua Destination Command Centre (staff only) |
| `prisma/catalogue/` | Commercial configuration (plans, entitlements) |
| `tests/` | Unit, integration and e2e tests |

---

## Original project: Rotorua Destination Command Centre

The sections below describe the destination-intelligence MVP this platform
grew from. It now lives at `/destination` and is restricted to platform
staff; its role is derived from real authentication (the old development
role switcher was removed because it let anyone act as an admin).

An AI destination intelligence platform for Rotorua, New Zealand — a
strategic decision-support layer for the visitor economy, not a generic
tourism dashboard. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for
the full design (data model, schema, agent architecture, permissions, MVP
boundary and roadmap) and
[`docs/CONNECTOR_STATUS.md`](docs/CONNECTOR_STATUS.md) for an honest note on
what's verified vs. code-complete-but-untested in this build.

Rotorua is the first configured destination, not the only one this can
support — see `src/config/destinations/`.

## What's here

- A fully governed Postgres data model (every observation row carries
  source, data type, timestamp, geography, time period, confidence and
  access level — `prisma/schema.prisma`)
- A CSV import pipeline for manual data sources, with the same governance
  requirements enforced at upload time
- Two real (keyless, free) API connectors — Open-Meteo (weather) and
  Nager.Date (public holidays) — code-complete but not run end-to-end in
  this build sandbox; see `docs/CONNECTOR_STATUS.md`
- An AI Discovery Engine that tests how an LLM currently describes Rotorua
  against a tracked bank of real traveller questions
- A Scenario Engine that answers strategic questions grounded only in what's
  actually in the database, labelled FACT / EVIDENCE / INFERENCE /
  HYPOTHESIS / RECOMMENDATION
- A Destination Command Centre dashboard covering every section in the
  brief, each showing real data or an honest "awaiting data" state — never
  invented numbers

## Getting started

```bash
npm install
cp .env.example .env   # then set DATABASE_URL (and optionally ANTHROPIC_API_KEY)
npx prisma migrate dev
npm run db:seed        # seeds destination + experience-category + tracked-prompt reference data only — no statistics
npm run dev
```

Open http://localhost:3000/destination while signed in as platform staff.

### Other scripts

```bash
npm run connectors:run   # runs the weather + holidays connectors from the CLI
npm run lint
npm run build
```

### Populating data

- **Manual import**: Data Governance → Manual import. CSV templates/column
  lists are shown in the form for Visitor metrics, Accommodation metrics and
  Demand signals.
- **Live connectors**: Data Governance → Run weather & holiday connectors.
  Requires outbound HTTPS to `api.open-meteo.com` / `date.nager.at`.
- **AI Discovery**: set `ANTHROPIC_API_KEY`, then AI Discovery → Run AI
  Discovery now.

## Stack

Next.js (App Router) + TypeScript + Tailwind + Prisma/PostgreSQL. See
`docs/ARCHITECTURE.md` for why.
