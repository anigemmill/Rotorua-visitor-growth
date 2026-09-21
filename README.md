# Rotorua Visitor Growth & Flow Intelligence

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

Open http://localhost:3000. Use the role switcher in the sidebar to try the
app as `PARTNER`/`ADMIN` (unlocks Data Governance's import/connector tools,
the Scenario Engine and AI Discovery run button) — there's no real login
system yet, see `src/lib/session.ts`.

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
