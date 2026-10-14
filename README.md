# Tourism AI Growth OS

**Outside In · Rotorua Tourism AI Growth Pilot**

The internal operating system for delivering a 12-week Tourism AI Growth Pilot
with ~10 Rotorua tourism operators: assessments, AI opportunity roadmaps,
implementation tracking, the Tourism AI Growth Collective, experiments with
baselines, reports, a versioned agent & workflow library, and commercial
management. It also includes an operator-level Growth Intelligence module (absorbed from
the Tourism Growth Intelligence prototype) and the original Rotorua destination
data layer (the Rotorua Pulse foundation).

- **Product, architecture, security model, test status, backlog and
  deployment:** [`docs/GROWTH_OS.md`](docs/GROWTH_OS.md)
- Destination data layer: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
  [`docs/CONNECTOR_STATUS.md`](docs/CONNECTOR_STATUS.md)

## Quick start

```bash
npm install
cp .env.example .env     # set DATABASE_URL and SEED_FOUNDER_EMAIL / SEED_FOUNDER_PASSWORD
npx prisma migrate deploy
npm run db:seed          # add SEED_DEMO=true (dev only) for a synthetic demo cohort
npm run dev
```

Open http://localhost:3000 and sign in as the founder.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint`, `npm run typecheck` | Static checks |
| `npm test` | Unit tests (domain logic, access rules) |
| `TEST_DATABASE_URL=… npm run test:integration` | Postgres integration tests (auth, operator data isolation) |
| `E2E_BASE_URL=… node tests/e2e/workflows.e2e.cjs` | Browser end-to-end workflow checks (needs demo seed + Playwright) |
| `npm run db:seed` | Programme skeleton, library, templates, founder (+ demo cohort if `SEED_DEMO=true`) |

## Principles built in

- Real data only: synthetic demo records are flagged and labelled
  "Demo data" / "Illustrative" everywhere.
- Operators can never see another operator's confidential information
  (enforced server-side and tested).
- Proposed, quoted, contracted and received revenue are never mixed.
- No AI output reaches an operator without human approval; no integration is
  shown as connected unless it has been tested.
- Cultural content is gated behind named cultural authority approval.
